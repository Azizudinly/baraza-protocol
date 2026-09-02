/**
 * Minisend Client Domain Adapter — Multi-Chain Stablecoin to Mobile Money Off-Ramp
 *
 * Conforms to SAD §5, Launch Memo 3 §3, and Minisend Architecture Spec v3.1 (§8.3).
 * Invokes the secure Edge API proxy (/api/payments/minisend) with cryptographic wallet proof.
 */

export interface MinisendOffRampParams {
  communityId?: string;
  proposalId?: string;
  callerWallet?: string;
  phone: string;
  usdcAmount: string;
  chain: 'stellar' | 'base' | 'polygon' | 'celo';
  currency?: 'KES' | 'UGX' | 'GHS' | 'NGN';
  memo?: string;
}

export interface MinisendOffRampResult {
  ok: boolean;
  orderId?: string;
  reference: string;
  kesAmount: number;
  error?: string;
}

/**
 * Initiates an off-ramp disbursement converting on-chain USDC to recipient mobile money.
 */
export async function usdcToMobileMoney(params: MinisendOffRampParams): Promise<MinisendOffRampResult> {
  try {
    const proxySecret = typeof window === 'undefined' ? process.env.PAYMENT_ADAPTER_PROXY_SECRET : undefined;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (proxySecret) {
      headers['authorization'] = `Bearer ${proxySecret}`;
    }

    const response = await fetch('/api/payments/minisend', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        reference: '',
        kesAmount: 0,
        error: (data as { message?: string })?.message || 'Minisend off-ramp request failed.',
      };
    }

    return {
      ok: true,
      orderId: (data as { orderId?: string })?.orderId,
      reference: (data as { reference: string })?.reference || '',
      kesAmount: Number((data as { kesAmount?: number })?.kesAmount || 0),
    };
  } catch (err) {
    return {
      ok: false,
      reference: '',
      kesAmount: 0,
      error: err instanceof Error ? err.message : 'Network error during Minisend off-ramp.',
    };
  }
}

/**
 * Backward-compatible alias for legacy caller components.
 */
export async function usdcToMpesa(params: {
  phone: string;
  usdcAmount: string;
  chain: 'base' | 'polygon' | 'celo' | 'stellar';
}): Promise<{ reference: string; kesAmount: number; error?: string }> {
  const res = await usdcToMobileMoney({
    phone: params.phone,
    usdcAmount: params.usdcAmount,
    chain: params.chain,
    currency: 'KES',
  });

  return {
    reference: res.reference,
    kesAmount: res.kesAmount,
    error: res.error,
  };
}
