import { describe, expect, it } from 'vitest';
import { sortGithubBounties, type GithubBounty } from '@/lib/githubBounties';

function bounty(overrides: Partial<GithubBounty>): GithubBounty {
  return {
    bountyId: 'bounty-1',
    githubIssueNumber: 1,
    title: 'Example bounty',
    bodyMd: '',
    amountUsd: null,
    status: 'open',
    deadline: null,
    reviewer: null,
    htmlUrl: 'https://github.com/Build-Africa-DAO/baraza-protocol/issues/1',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('sortGithubBounties', () => {
  it('puts open bounties first, then sorts every other state by recency', () => {
    const result = sortGithubBounties([
      bounty({ githubIssueNumber: 2, status: 'claimed', updatedAt: '2026-07-02T00:00:00Z' }),
      bounty({ githubIssueNumber: 1, status: 'open', updatedAt: '2026-07-01T00:00:00Z' }),
      bounty({ githubIssueNumber: 3, status: 'paid', updatedAt: '2026-07-03T00:00:00Z' }),
    ]);

    expect(result.map((item) => item.githubIssueNumber)).toEqual([1, 3, 2]);
  });

  it('sorts bounties in the same state by newest update first', () => {
    const result = sortGithubBounties([
      bounty({ githubIssueNumber: 1, updatedAt: '2026-07-01T00:00:00Z' }),
      bounty({ githubIssueNumber: 2, updatedAt: '2026-07-05T00:00:00Z' }),
    ]);

    expect(result.map((item) => item.githubIssueNumber)).toEqual([2, 1]);
  });
});
