import { describe, expect, it } from 'vitest';
import {
  exportReceiptToJson,
  exportReceiptsToCsv,
  generatePayoutReceipt,
  maskRecipientIdentifier,
  validateReceiptExportEligibility,
  type PayoutRecord,
} from '../receipt';

describe('Payout Receipt Privacy & Export Suite', () => {
  it('masks phone numbers correctly to protect member privacy', () => {
    const rawPhone = '+254712345678';
    const masked = maskRecipientIdentifier(rawPhone);
    expect(masked).toBe('+2547*****678');
    expect(masked).not.toContain('12345');
  });

  it('masks blockchain addresses to preserve recipient confidentiality', () => {
    const stellarAddress = 'GB7X4K9LAOMN64QRT3778ABCD';
    const masked = maskRecipientIdentifier(stellarAddress);
    expect(masked).toBe('GB7X4K...ABCD');
  });

  it('generates a durable receipt from an approved payout', () => {
    const payout: PayoutRecord = {
      id: 'payout-uuid-101',
      communityId: 'comm-nairobi-01',
      amount: 15000,
      currency: 'KES',
      status: 'APPROVED',
      recipient: '+254712345678',
      category: 'Agricultural Inputs',
      memo: 'Fertilizer bulk grant',
      txReference: 'MPESA-QRT89123',
      reviewedBy: 'Treasurer Mary',
      reviewedAt: '2026-08-19T10:00:00Z',
      createdAt: '2026-08-18T12:00:00Z',
    };

    const receipt = generatePayoutReceipt(payout, 'Nairobi Green Chama');
    expect(receipt.receiptId.startsWith('RCPT-PAYOUT-U')).toBe(true);
    expect(receipt.amount).toBe(15000);
    expect(receipt.currency).toBe('KES');
    expect(receipt.status).toBe('APPROVED');
    expect(receipt.reviewer).toBe('Treasurer Mary');
    expect(receipt.maskedRecipient).toBe('+2547*****678');
    expect(receipt.txReference).toBe('MPESA-QRT89123');
  });

  it('validates export eligibility for pending vs approved payouts', () => {
    const pendingPayout: PayoutRecord = {
      id: 'p-1',
      communityId: 'c-1',
      amount: 500,
      currency: 'KES',
      status: 'PENDING',
      recipient: '+254700000000',
      createdAt: '2026-08-19T00:00:00Z',
    };
    const approvedPayout: PayoutRecord = {
      ...pendingPayout,
      status: 'APPROVED',
    };

    expect(validateReceiptExportEligibility(pendingPayout).eligible).toBe(false);
    expect(validateReceiptExportEligibility(approvedPayout).eligible).toBe(true);
  });

  it('exports multiple receipts to valid CSV format', () => {
    const payout: PayoutRecord = {
      id: 'payout-1',
      communityId: 'comm-1',
      amount: 2500,
      currency: 'KES',
      status: 'DISBURSED',
      recipient: '+254799887766',
      txReference: 'TX-9988',
      createdAt: '2026-08-19T08:00:00Z',
    };

    const receipt = generatePayoutReceipt(payout);
    const csv = exportReceiptsToCsv([receipt]);
    expect(csv).toContain('Receipt ID,Payout ID,Community Name');
    expect(csv).toContain('"2500"');
    expect(csv).toContain('"TX-9988"');
  });

  it('exports single receipt to valid JSON', () => {
    const payout: PayoutRecord = {
      id: 'payout-2',
      communityId: 'comm-2',
      amount: 4000,
      currency: 'KES',
      status: 'APPROVED',
      recipient: '+254711223344',
      createdAt: '2026-08-19T09:00:00Z',
    };

    const receipt = generatePayoutReceipt(payout);
    const jsonStr = exportReceiptToJson(receipt);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.amount).toBe(4000);
    expect(parsed.maskedRecipient).toBe('+2547*****344');
  });
});
