export type PayoutStatus = 'pending' | 'approved' | 'settled' | 'rejected' | 'failed';

export interface PayoutReceiptInput {
  payoutId: string;
  communityId: string;
  communityName: string;
  recipientWallet: string;
  recipientDisplay?: string | null;
  amount: string | number;
  assetCode: string;
  status: PayoutStatus;
  reviewerWallet?: string | null;
  reviewerNotes?: string | null;
  transactionRef?: string | null;
  approvedAt?: string | null;
  settledAt?: string | null;
  createdAt: string;
}

export interface SanitizedPayoutReceipt {
  receiptId: string;
  community: {
    id: string;
    name: string;
  };
  payout: {
    id: string;
    amount: string;
    assetCode: string;
    status: PayoutStatus;
  };
  recipient: {
    maskedWallet: string;
    displayName: string;
  };
  audit: {
    reviewerMaskedWallet: string | null;
    reviewerNotes: string | null;
    transactionReference: string | null;
    createdAt: string;
    approvedAt: string | null;
    settledAt: string | null;
  };
  verification: {
    isSettled: boolean;
    isApproved: boolean;
    generatedAt: string;
  };
}

export function maskWallet(wallet: string | null | undefined): string {
  if (!wallet || wallet.length < 10) {
    return '****';
  }
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function generatePayoutReceipt(input: PayoutReceiptInput): SanitizedPayoutReceipt {
  if (!input.payoutId || !input.communityId) {
    throw new Error('Invalid payout input: payoutId and communityId are required');
  }

  const maskedRecipient = maskWallet(input.recipientWallet);
  const maskedReviewer = input.reviewerWallet ? maskWallet(input.reviewerWallet) : null;
  const isSettled = input.status === 'settled';
  const isApproved = input.status === 'approved' || isSettled;

  return {
    receiptId: `rcpt_${input.payoutId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}_${Date.now().toString(36)}`,
    community: {
      id: input.communityId,
      name: input.communityName || 'Unnamed Community',
    },
    payout: {
      id: input.payoutId,
      amount: String(input.amount),
      assetCode: input.assetCode || 'BRZA',
      status: input.status,
    },
    recipient: {
      maskedWallet: maskedRecipient,
      displayName: input.recipientDisplay || maskedRecipient,
    },
    audit: {
      reviewerMaskedWallet: maskedReviewer,
      reviewerNotes: input.reviewerNotes || null,
      transactionReference: input.transactionRef || null,
      createdAt: input.createdAt,
      approvedAt: input.approvedAt || null,
      settledAt: input.settledAt || null,
    },
    verification: {
      isSettled,
      isApproved,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function exportPayoutReceiptAsJson(input: PayoutReceiptInput): string {
  const receipt = generatePayoutReceipt(input);
  return JSON.stringify(receipt, null, 2);
}

export function exportPayoutReceiptsAsCsv(inputs: PayoutReceiptInput[]): string {
  const headers = [
    'Receipt ID',
    'Payout ID',
    'Community ID',
    'Community Name',
    'Amount',
    'Asset',
    'Status',
    'Recipient (Masked)',
    'Reviewer (Masked)',
    'Transaction Ref',
    'Created At',
    'Settled At'
  ];

  const rows = inputs.map((input) => {
    const r = generatePayoutReceipt(input);
    return [
      r.receiptId,
      r.payout.id,
      r.community.id,
      `"${r.community.name.replace(/"/g, '""')}"`,
      r.payout.amount,
      r.payout.assetCode,
      r.payout.status,
      r.recipient.maskedWallet,
      r.audit.reviewerMaskedWallet || 'N/A',
      r.audit.transactionReference || 'N/A',
      r.audit.createdAt,
      r.audit.settledAt || 'N/A'
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
