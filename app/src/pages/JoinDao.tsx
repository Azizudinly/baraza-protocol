import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Phone,
  Stars,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { storePaymentOrderActivationSecret } from "@/lib/payments";
import { calculateDynamicFee } from "@/lib/payments/feeEngine";
import Layout from "@/components/Layout";
import { useCommunity } from "@/hooks/useCommunities";
import { useToast } from "@/hooks/use-toast";
import { formatKSh } from "@/lib/utils";
import { normaliseKenyanPhone } from "@/lib/phone";
import CommunityBanner from "@/components/CommunityBanner";
import { useSeo } from "@/lib/seo";
import { PRODUCT_ENVIRONMENT } from "@/lib/network";
import { useAccount } from "@/contexts/AccountContext";

const joinSteps = [
  { label: "Invite opened", state: "current" },
  { label: "Payment method selected", state: "pending" },
  { label: "Payment proof submitted", state: "pending" },
  { label: "Payment confirmed", state: "pending" },
  { label: "Credential minted", state: "pending" },
  { label: "Active member", state: "pending" },
];

function ActivationTracker() {
  return (
    <div className="baraza-card p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Membership activation</h2>
          <p className="mt-1 text-xs">Payment proof and membership approval stay separate.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-[11px] font-semibold">
          Step 1 of {joinSteps.length}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {joinSteps.map((step, index) => (
          <div
            key={step.label}
            className={
              step.state === "current"
                ? "rounded-lg border border-primary bg-primary/10 p-3"
                : "rounded-lg border p-3"
            }
          >
            <div
              className={
                step.state === "current"
                  ? "mb-2 grid h-7 w-7 place-items-center rounded-full"
                  : "mb-2 grid h-7 w-7 place-items-center rounded-full border"
              }
            >
              {step.state === "done" ? <Check className="h-4 w-4" /> : <span className="text-[11px] font-bold">{index + 1}</span>}
            </div>
            <span className="block text-[11px] font-bold uppercase tracking-widest">
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateLocalOrderId(): string {
  return `ord_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function JoinDao() {
  const { id } = useParams<{ id: string }>();
  const { community } = useCommunity(id);
  const account = useAccount();
  useSeo({
    title: community ? `Join ${community.name}` : "Join a community",
    description: "Verify your phone, pay membership dues via M-Pesa, and activate your membership.",
    path: id ? `/join/${id}` : undefined,
    noIndex: true,
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [stellarTxHash, setStellarTxHash] = useState("");
  const [stellarAmountXlm, setStellarAmountXlm] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingStellar, setIsVerifyingStellar] = useState(false);
  const [pendingWalletJoin, setPendingWalletJoin] = useState(false);

  const amount = community?.membershipFee ?? 0;
  const feeBreakdown = calculateDynamicFee(amount * 100, 'KES', true);
  const isFree = feeBreakdown.isFree;

  const normalisedPhone = normaliseKenyanPhone(phone);
  const canSubmit = (isFree || (normalisedPhone !== null && amount > 0)) && !isSubmitting;
  const canVerifyStellar = /^[a-f0-9]{64}$/i.test(stellarTxHash.trim()) &&
    Number(stellarAmountXlm) > 0 &&
    !isVerifyingStellar;

  function startAccountJoin(accountId: string) {
    if (!id) return;
    const orderId = `ord_local_wallet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    toast({
      title: "Account payment started",
      description: `Membership dues are linked to ${accountId.slice(0, 6)}...${accountId.slice(-4)}.`,
    });
    navigate(`/join/${id}/status?orderId=${encodeURIComponent(orderId)}&rail=wallet`);
  }

  useEffect(() => {
    if (!pendingWalletJoin || !account.authenticated || !account.accountId) return;
    setPendingWalletJoin(false);
    startAccountJoin(account.accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.accountId, account.authenticated, pendingWalletJoin]);

  async function handleFreeJoin() {
    if (!id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const walletAddress = account.accountId || `phone:${phone || 'anon'}`;
      const res = await fetch("/api/membership/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderId: "free_activation",
          communityId: id,
          walletAddress,
          activationSecret: "free_activation_secret",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (res.ok && data.ok) {
        toast({
          title: "Membership Activated",
          description: `Welcome to ${community?.name || 'the community'}!`,
        });
        navigate(`/dashboard/${id}`);
        return;
      }
      throw new Error(data.message || "Failed to activate free membership.");
    } catch (err: unknown) {
      toast({
        title: "Activation failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMpesaSubmit() {
    if (isFree) {
      return handleFreeJoin();
    }
    if (!canSubmit || !id || !normalisedPhone) return;
    setIsSubmitting(true);

    let orderId: string | null = null;
    let activationSecret: string | null = null;
    let usedFallback = false;

    try {
      const res = await fetch("/api/mpesa/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: `+254${normalisedPhone}`,
          communityId: id,
          amount: Math.round(feeBreakdown.totalExpectedMinor / 100),
          currency: "KES",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { orderId?: string; activationSecret?: string };
        orderId = data.orderId ?? null;
        activationSecret = data.activationSecret ?? null;
      }
    } catch {
      // network/CORS/local-dev-no-vercel - fall through to mock
    }

    if (!orderId) {
      orderId = generateLocalOrderId();
      usedFallback = true;
    }

    toast({
      title: usedFallback ? "Simulator unreachable - using local order" : "M-Pesa prompt sent",
      description: usedFallback
        ? "Run \"vercel dev\" to exercise the real /api/mpesa/simulate endpoint."
        : `Enter your M-Pesa PIN on your phone to confirm KSh ${formatKSh(feeBreakdown.totalExpectedMinor / 100)}.`,
    });

    setIsSubmitting(false);
    if (activationSecret) storePaymentOrderActivationSecret(orderId, activationSecret);
    navigate(`/join/${id}/status?orderId=${encodeURIComponent(orderId)}`);
  }

  async function handleStellarSubmit() {
    if (!id || !canVerifyStellar) return;
    setIsVerifyingStellar(true);

    try {
      let intentToken: string | null = null;
      try {
        const intentRes = await fetch("/api/stellar/create-payment-intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            communityId: id,
            amountXlm: Number(stellarAmountXlm),
            amountKes: amount,
            environment: PRODUCT_ENVIRONMENT,
          }),
        });
        if (intentRes.ok) {
          const intentData = (await intentRes.json()) as { intentToken?: string };
          intentToken = intentData.intentToken ?? null;
        }
      } catch {
        // Intent service unavailable
      }

      const res = await fetch("/api/stellar/verify-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          intentToken
            ? { intentToken, txHash: stellarTxHash.trim().toLowerCase(), environment: PRODUCT_ENVIRONMENT }
            : {
                communityId: id,
                txHash: stellarTxHash.trim().toLowerCase(),
                amountXlm: Number(stellarAmountXlm),
                environment: PRODUCT_ENVIRONMENT,
              },
        ),
      });
      const data = (await res.json()) as {
        orderId?: string;
        activationSecret?: string | null;
        ledger?: number;
        amountXlm?: number;
        persisted?: boolean;
        message?: string;
      };

      if (!res.ok || !data.orderId) {
        throw new Error(data.message ?? "Could not verify this transfer.");
      }

      toast({
        title: "Transfer verified",
        description: data.persisted
          ? `Payment record ${data.ledger ?? "confirmed"} was accepted.`
          : "The transfer was verified. This will continue in local preview mode.",
      });

      if (data.activationSecret) storePaymentOrderActivationSecret(data.orderId, data.activationSecret);
      navigate(`/join/${id}/status?orderId=${encodeURIComponent(data.orderId)}&rail=stellar`);
    } catch (err) {
      toast({
        title: "Transfer verification failed",
        description: err instanceof Error ? err.message : "Check the transaction hash and try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingStellar(false);
    }
  }

  return (
    <Layout>
      <section className="relative overflow-hidden py-8 md:py-12">
        <div className="container relative z-10 mx-auto px-4">
          <Link to={community ? `/dashboard/${community.id}` : "/communities"} className="mb-6 inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to community
          </Link>

          <div className="mx-auto max-w-5xl space-y-5">
            <div className="baraza-card overflow-hidden">
              <CommunityBanner className="rounded-none border-0 border-b">
              <div className="p-5 md:p-7">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest">Join community</p>
                    <h1 className="mt-2 font-display text-3xl font-bold">
                      {community?.name ?? "Community"}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6">
                      Pay with mobile money, bank transfer, or your Privy account. Your membership record stays attached to one Baraza account.
                    </p>
                  </div>
                  <div className="w-full rounded-lg border px-4 py-3 md:w-auto md:text-right">
                    <p className="text-xs">Membership Dues</p>
                    <p className="font-display text-lg font-bold">
                      {isFree ? "Free / Zero Dues" : formatKSh(amount)}
                    </p>
                  </div>
                </div>
              </div>
              </CommunityBanner>

              {/* Pre-Transaction Itemized Fee Disclosure */}
              {!isFree && (
                <div className="mx-5 mt-5 rounded-lg border p-4 bg-muted/30 md:mx-6">
                  <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Pre-Transaction Fee Breakdown
                  </h3>
                  <div className="grid gap-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Community Dues</span>
                      <span className="font-medium">KSh {formatKSh(feeBreakdown.baseAmountMinor / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Baraza Platform Fee (2.0%)</span>
                      <span className="font-medium">KSh {formatKSh(feeBreakdown.platformFeeMinor / 100)}</span>
                    </div>
                    {feeBreakdown.carrierCostMinor > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Carrier Processing Cost (0.5% capped)</span>
                        <span className="font-medium">KSh {formatKSh(feeBreakdown.carrierCostMinor / 100)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold text-sm">
                      <span>Total Expected Payment</span>
                      <span className="text-primary font-bold">KSh {formatKSh(feeBreakdown.totalExpectedMinor / 100)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 p-5 lg:grid-cols-3 md:p-6">
                <div className="rounded-lg border p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-semibold">Phone-first M-Pesa</h2>
                      <p className="text-xs">Primary mobile money rail</p>
                    </div>
                  </div>

                  {!isFree ? (
                    <>
                      <label htmlFor="join-phone" className="mb-2 block text-xs font-semibold">M-Pesa phone number</label>
                      <div className="flex rounded-lg border focus-within:border-current">
                        <span className="border-r px-3 py-3 text-sm">+254</span>
                        <input
                          id="join-phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="min-w-0 flex-1 px-3 py-3 text-sm outline-none"
                          placeholder="e.g. 0712 345 678"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                        />
                      </div>
                      <p className="mt-2 text-[11px]">We&apos;ll send an STK prompt. Your number stays private.</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">This community has no activation dues. You can join immediately.</p>
                  )}

                  <button
                    type="button"
                    onClick={isFree ? handleFreeJoin : handleMpesaSubmit}
                    disabled={!canSubmit}
                    className="btn-warm mt-5 w-full justify-center gap-2 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isFree ? "Activating..." : "Sending prompt..."}
                      </>
                    ) : isFree ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Join Free Community
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Request M-Pesa Prompt
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-lg border p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg">
                      <Stars className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-semibold">Bank or international transfer</h2>
                      <p className="text-xs">Verify transfer proof</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6">
                    Paste the transaction reference supplied by your transfer provider. Baraza verifies it before activating membership.
                  </p>

                  <label htmlFor="stellar-amount" className="mb-2 mt-4 block text-xs font-semibold">Transfer amount reference</label>
                  <input
                    id="stellar-amount"
                    value={stellarAmountXlm}
                    onChange={(event) => setStellarAmountXlm(event.target.value)}
                    className="w-full rounded-lg border px-3 py-3 text-sm outline-none"
                    inputMode="decimal"
                    placeholder="1"
                  />

                  <label htmlFor="stellar-tx" className="mb-2 mt-3 block text-xs font-semibold">Transaction reference</label>
                  <input
                    id="stellar-tx"
                    value={stellarTxHash}
                    onChange={(event) => setStellarTxHash(event.target.value)}
                    className="w-full rounded-lg border px-3 py-3 font-mono text-xs outline-none"
                    placeholder="64-character transaction reference"
                  />

                  <button
                    type="button"
                    onClick={() => void handleStellarSubmit()}
                    disabled={!canVerifyStellar}
                    className="btn-warm mt-5 w-full justify-center gap-2 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isVerifyingStellar ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying transfer...
                      </>
                    ) : (
                      <>
                        <Stars className="h-4 w-4" />
                        Verify transfer
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-lg border p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-semibold">Privy account</h2>
                      <p className="text-xs">Private account access</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6">
                    Log in or create an account to pay, receive membership credentials, and vote.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (account.authenticated && account.accountId) {
                        startAccountJoin(account.accountId);
                        return;
                      }
                      setPendingWalletJoin(true);
                      account.login();
                    }}
                    disabled={!account.ready || !account.configured}
                    className="btn-ghost mt-5 w-full justify-center gap-2 py-3 text-sm font-bold"
                  >
                    <Wallet className="h-4 w-4" />
                    {!account.ready ? "Loading..." : account.authenticated ? "Pay from Privy account" : "Log in with Privy"}
                  </button>
                  {!account.authenticated && account.configured && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingWalletJoin(true);
                        account.createAccount();
                      }}
                      className="mt-3 w-full text-center text-xs font-semibold"
                    >
                      Create a Privy account
                    </button>
                  )}
                  <Link to="/profile" className="mt-3 inline-flex text-xs font-semibold">
                    Manage Baraza account
                  </Link>
                </div>
              </div>

              <div className="mx-5 mb-5 rounded-lg border p-4 md:mx-6 md:mb-6">
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p className="text-sm leading-6">
                    <strong>Payment confirmed is not membership activation.</strong> Your membership activates after proof review and approval.
                  </p>
                </div>
              </div>
            </div>

            <ActivationTracker />
          </div>
        </div>
      </section>
    </Layout>
  );
}
