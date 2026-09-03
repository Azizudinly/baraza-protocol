// app/api/user/types.ts
// Strict Zero-Any TypeScript Contracts for Phase P6 SaaS Endpoints

export type SupportedLocale = 'en' | 'sw' | 'sheng';
export type SupportedCountry = 'KE' | 'UG' | 'TZ' | 'RW' | 'GH' | 'NG';
export type SupportedCurrency = 'KES' | 'UGX' | 'GHS' | 'NGN' | 'USD';
export type OfficerRole = 'founder' | 'admin' | 'treasurer' | 'member';
export type ActivationStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type DuesStatus = 'ACTIVE' | 'OVERDUE_DUES';
export type DisputeStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED_REFUNDED' | 'REJECTED';
export type DisputeType = 'PAYMENT_NOT_CREDITED' | 'WRONG_AMOUNT' | 'DUPLICATE_DEBIT' | 'OTHER';

export interface UserNotificationPreferences {
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
  push: boolean;
}

export interface UserProfileDTO {
  id: string;
  walletAddress?: string | null;
  privyDid?: string | null;
  displayName: string;
  avatarUrl: string;
  bio: string;
  locale: SupportedLocale;
  country: SupportedCountry;
  defaultCurrency: SupportedCurrency;
  hasVerifiedPhone: boolean;
  phoneVerifiedAt?: string | null;
  notifications: UserNotificationPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileResponse {
  ok: boolean;
  profile: UserProfileDTO;
}

export interface UserProfileUpdateRequest {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  locale?: SupportedLocale;
  country?: SupportedCountry;
  defaultCurrency?: SupportedCurrency;
  notifications?: Partial<UserNotificationPreferences>;
}

export interface UserMembershipSummary {
  communityId: string;
  name: string;
  role: OfficerRole;
  activationStatus: ActivationStatus;
  joinedAt: string;
  duesStatus: DuesStatus;
  outstandingDuesMinor: number;
  votingPower: number;
  vaultBalanceMinor: number;
  currency: string;
  membershipStatus: string;
}

export interface UserMembershipsResponse {
  ok: boolean;
  memberships: UserMembershipSummary[];
}

export interface StatementExportQuery {
  communityId: string;
  startDate?: string;
  endDate?: string;
  format?: 'csv' | 'ndjson';
  cursor?: string;
}

export interface StatementRow {
  date: string;
  referenceId: string;
  referenceType: string;
  debitAccount: string;
  creditAccount: string;
  amountMinor: number;
  currency: string;
}

export interface OfficerMutationRequest {
  communityId: string;
  targetWallet: string;
  newRole: OfficerRole;
  action: 'ASSIGN' | 'REVOKE';
}

export interface DisputeSubmissionRequest {
  orderId: string;
  communityId: string;
  disputeType: DisputeType;
  amountDisputedMinor: number;
  reason: string;
  telcoProofReference?: string;
  evidenceUrl?: string;
}

export interface DisputeResolutionRequest {
  disputeId: string;
  resolution: 'REFUND' | 'REJECT';
  resolutionNotes: string;
}
