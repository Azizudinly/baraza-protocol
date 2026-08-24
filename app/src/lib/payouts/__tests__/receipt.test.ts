import { describe, expect, it } from 'vitest';
import {
  generatePayoutReceipt,
  exportPayoutReceiptAsJson,
  exportPayoutReceiptsAsCsv,
  maskWallet,
  type PayoutReceiptInput
} from '../receipt';

describe('Payout Receipt Export Library', () => {
  const mockCompletedPayout: PayoutReceiptInput = {
    payoutId: 'payout_abc123',
    communityId: 'comm_xyz789',
    communityName: 'Nairobi Builders DAO',
    recipientWallet: 'GBSKKK4TXPM5HSMDXZGLZLHH6ZWW7ON5Q3EU6R5Y27MFHLVV4TYGQTNW',
    recipientDisplay: 'Amani Dev',
    amount: '250.00',
    assetCode: 'BRZA',
    status: 'settled',
    reviewerWallet: 'GAESNHZI4CXHMFKXERSB7JHRJDOBLB2TJ6RAUJBODVEVIKOXM5YPYDA4',
    reviewerNotes: 'Approved for completion of Milestone 2',
    transactionRef: '5f9b4c2a1e8d7f3b6c5a4e2d1f0b9a8c7e6d5f4a3b2c1e0f9a8b7c6d5e4f3a2b',
    approvedAt: '2026-08-20T10:00:00.000Z',
    settledAt: '2026-08-20T10:05:00.000Z',
    createdAt: '2026-08-19T14:30:00.000Z',
  };

  it('masks sensitive wallet addresses for privacy preservation', () => {
    const masked = maskWallet('GBSKKK4TXPM5HSMDXZGLZLHH6ZWW7ON5Q3EU6R5Y27MFHLVV4TYGQTNW');
    expect(masked).toBe('GBSK...QTNW');
    expect(maskWallet(null)).toBe('****');
    expect(maskWallet('')).toBe('****');
  });

  it('generates a complete sanitized receipt for settled payouts', () => {
    const receipt = generatePayoutReceipt(mockCompletedPayout);

    expect(receipt.receiptId).toContain('payoutabc123');
    expect(receipt.payout.amount).toBe('250.00');
    expect(receipt.payout.assetCode).toBe('BRZA');
    expect(receipt.payout.status).toBe('settled');
    expect(receipt.recipient.maskedWallet).toBe('GBSK...QTNW');
    expect(receipt.recipient.displayName).toBe('Amani Dev');
    expect(receipt.audit.reviewerMaskedWallet).toBe('GAES...YDA4');
    expect(receipt.audit.transactionReference).toBe(mockCompletedPayout.transactionRef);
    expect(receipt.verification.isSettled).toBe(true);
    expect(receipt.verification.isApproved).toBe(true);
  });

  it('handles pending / unapproved payouts without transaction reference', () => {
    const pendingPayout: PayoutReceiptInput = {
      payoutId: 'payout_pending999',
      communityId: 'comm_xyz789',
      communityName: 'Lagos Tech Hub',
      recipientWallet: '0x1234567890abcdef1234567890abcdef12345678',
      amount: 100,
      assetCode: 'USDC',
      status: 'pending',
      createdAt: '2026-08-24T12:00:00.000Z',
    };

    const receipt = generatePayoutReceipt(pendingPayout);
    expect(receipt.verification.isSettled).toBe(false);
    expect(receipt.verification.isApproved).toBe(false);
    expect(receipt.audit.transactionReference).toBeNull();
    expect(receipt.audit.reviewerMaskedWallet).toBeNull();
  });

  it('exports formatted JSON and CSV', () => {
    const jsonStr = exportPayoutReceiptAsJson(mockCompletedPayout);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.payout.id).toBe('payout_abc123');

    const csvStr = exportPayoutReceiptsAsCsv([mockCompletedPayout]);
    expect(csvStr).toContain('Receipt ID,Payout ID,Community ID');
    expect(csvStr).toContain('Nairobi Builders DAO');
    expect(csvStr).toContain('GBSK...QTNW');
  });
});
