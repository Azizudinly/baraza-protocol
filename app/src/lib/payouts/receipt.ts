/**
 * Payout Receipt Export for Community Admins
 * Provides durable audit receipts for approved community disbursements
 * while preserving member privacy by masking sensitive PII (phone/wallet).
 */

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'FAILED';

export interface PayoutRecord {
  id: string;
  communityId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  recipient: string;
  category?: string;
  memo?: string;
  txReference?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  disbursedAt?: string | null;
  createdAt: string;
}

export interface PayoutReceipt {
  receiptId: string;
  payoutId: string;
  communityId: string;
  communityName: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  reviewer: string;
  reviewedAt: string;
  disbursedAt: string | null;
  txReference: string;
  maskedRecipient: string;
  category: string;
  memo: string;
  exportedAt: string;
}

/**
 * Masks sensitive recipient PII (phone number, Stellar public key, EVM address).
 */
export function maskRecipientIdentifier(identifier: string): string {
  if (!identifier) return 'ANONYMOUS';

  const clean = identifier.trim();

  // Phone number masking: +254 712 345 678 -> +254 7*** ***678
  if (/^\+?\d{9,15}$/.test(clean.replace(/\s+/g, ''))) {
    const compact = clean.replace(/\s+/g, '');
    const prefix = compact.slice(0, 5);
    const suffix = compact.slice(-3);
    return `${prefix}*****${suffix}`;
  }

  // Wallet address (Stellar G-key or EVM 0x address)
  if (clean.length > 12) {
    const prefix = clean.slice(0, 6);
    const suffix = clean.slice(-4);
    return `${prefix}...${suffix}`;
  }

  return '***';
}

/**
 * Generates an immutable, audit-ready receipt object.
 */
export function generatePayoutReceipt(
  payout: PayoutRecord,
  communityName: string = 'Baraza Community',
  defaultReviewer: string = 'System Admin'
): PayoutReceipt {
  if (!payout) {
    throw new Error('Payout record is required to generate receipt');
  }

  const receiptId = `RCPT-${payout.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return {
    receiptId,
    payoutId: payout.id,
    communityId: payout.communityId,
    communityName,
    amount: Number(payout.amount),
    currency: payout.currency || 'KES',
    status: payout.status,
    reviewer: payout.reviewedBy || defaultReviewer,
    reviewedAt: payout.reviewedAt || payout.createdAt,
    disbursedAt: payout.disbursedAt || null,
    txReference: payout.txReference || 'N/A (Pending Settlement)',
    maskedRecipient: maskRecipientIdentifier(payout.recipient),
    category: payout.category || 'General Disbursement',
    memo: payout.memo || '',
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Verifies if a payout is in an exportable state (e.g. APPROVED or DISBURSED).
 */
export function validateReceiptExportEligibility(payout: PayoutRecord): { eligible: boolean; reason?: string } {
  if (!payout) {
    return { eligible: false, reason: 'Payout record not found' };
  }

  if (payout.status === 'PENDING') {
    return { eligible: false, reason: 'Payout is still pending approval' };
  }

  if (payout.status === 'REJECTED') {
    return { eligible: false, reason: 'Rejected payouts cannot generate completion receipts' };
  }

  if (payout.amount <= 0) {
    return { eligible: false, reason: 'Payout amount must be greater than zero' };
  }

  return { eligible: true };
}

/**
 * Exports receipts into a sanitised, standard CSV ledger layout.
 */
export function exportReceiptsToCsv(receipts: PayoutReceipt[]): string {
  const headers = [
    'Receipt ID',
    'Payout ID',
    'Community Name',
    'Amount',
    'Currency',
    'Status',
    'Masked Recipient',
    'Reviewer',
    'Reviewed At',
    'Disbursed At',
    'Tx Reference',
    'Category',
    'Memo',
    'Exported At',
  ];

  const escapeCsv = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = receipts.map((r) => [
    escapeCsv(r.receiptId),
    escapeCsv(r.payoutId),
    escapeCsv(r.communityName),
    escapeCsv(r.amount),
    escapeCsv(r.currency),
    escapeCsv(r.status),
    escapeCsv(r.maskedRecipient),
    escapeCsv(r.reviewer),
    escapeCsv(r.reviewedAt),
    escapeCsv(r.disbursedAt),
    escapeCsv(r.txReference),
    escapeCsv(r.category),
    escapeCsv(r.memo),
    escapeCsv(r.exportedAt),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Serialises single receipt into a structured JSON string.
 */
export function exportReceiptToJson(receipt: PayoutReceipt): string {
  return JSON.stringify(receipt, null, 2);
}
