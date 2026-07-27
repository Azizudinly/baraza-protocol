export type BountyClaimStatus = 'pending' | 'approved';

export interface BountyClaimState {
  bountyId: string;
  status: BountyClaimStatus;
}

interface ErrorBody {
  error?: string;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as ErrorBody;
    return new Error(body.error || fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function listBountyClaimStates(): Promise<BountyClaimState[]> {
  const response = await fetch('/api/bounties/claims');
  if (!response.ok) throw await responseError(response, 'Could not load claim status.');
  const body = await response.json() as { claims?: BountyClaimState[] };
  return body.claims ?? [];
}

export async function submitBountyClaim(input: {
  bountyId: string;
  claimantDisplayName: string;
  accessToken: string;
}): Promise<void> {
  const response = await fetch('/api/bounties/claims', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      bountyId: input.bountyId,
      claimantDisplayName: input.claimantDisplayName,
    }),
  });

  if (!response.ok) throw await responseError(response, 'Could not submit the claim.');
}
