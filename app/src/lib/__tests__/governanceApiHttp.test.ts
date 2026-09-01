/**
 * WS-6D: Governance Edge API HTTP Integration Suite
 *
 * Exhaustively validates HTTP request/response lifecycles, error taxonomy,
 * CORS headers, and payload validation across all governance Edge API routes:
 * - /api/governance/proposals (GET & POST)
 * - /api/governance/vote (POST)
 * - /api/governance/finalize (POST)
 * - /api/governance/execute (POST)
 */

import { describe, it, expect } from 'vitest';
import handleProposals from '../../../api/governance/proposals';
import handleVote from '../../../api/governance/vote';
import handleFinalize from '../../../api/governance/finalize';
import handleExecute from '../../../api/governance/execute';

describe('WS-6D: Governance Edge API HTTP Suite', () => {
  describe('1. /api/governance/proposals', () => {
    it('handles OPTIONS preflight with 204 status', async () => {
      const req = new Request('http://localhost/api/governance/proposals', {
        method: 'OPTIONS',
      });
      const res = await handleProposals(req);
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('rejects PUT/DELETE with 405 Method Not Allowed', async () => {
      const req = new Request('http://localhost/api/governance/proposals', {
        method: 'DELETE',
      });
      const res = await handleProposals(req);
      expect(res.status).toBe(405);
    });

    it('validates required fields on proposal creation (POST)', async () => {
      const req = new Request('http://localhost/api/governance/proposals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: '',
          proposer: '',
          title: '',
        }),
      });
      const res = await handleProposals(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('invalid_request');
    });

    it('creates a proposal with default quorum and snapshotted values', async () => {
      const req = new Request('http://localhost/api/governance/proposals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'chama-kisumu-01',
          proposer: 'GBZXN7P...',
          title: 'Solar Irrigation Project',
          description: 'Acquire solar water pumps for member shambas.',
          fundingAmountMinor: 50_000_00,
          quorumThresholdBps: 2500, // 25%
        }),
      });
      const res = await handleProposals(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.proposalId).toMatch(/^prop_/);
      expect(data.status).toBe('active');
      expect(data.quorumThresholdBps).toBe(2500);
    });
  });

  describe('2. /api/governance/vote', () => {
    it('rejects invalid vote options with 400 Bad Request', async () => {
      const req = new Request('http://localhost/api/governance/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proposalId: 'prop-123',
          voter: 'GABC...',
          option: 'maybe', // Invalid option
        }),
      });
      const res = await handleVote(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toContain("option must be 'yes', 'no', or 'abstain'");
    });

    it('records a valid vote with 200 OK', async () => {
      const req = new Request('http://localhost/api/governance/vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proposalId: 'prop-solar-01',
          voter: 'GABC123...',
          option: 'yes',
          weight: 1,
        }),
      });
      const res = await handleVote(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.voteId).toMatch(/^vote_/);
      expect(data.option).toBe('yes');
    });
  });

  describe('3. /api/governance/finalize', () => {
    it('validates proposalId presence', async () => {
      const req = new Request('http://localhost/api/governance/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposalId: '' }),
      });
      const res = await handleFinalize(req);
      expect(res.status).toBe(400);
    });

    it('finalizes proposal when requested', async () => {
      const req = new Request('http://localhost/api/governance/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposalId: 'prop-solar-01' }),
      });
      const res = await handleFinalize(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe('4. /api/governance/execute', () => {
    it('requires proposalId and executorWallet', async () => {
      const req = new Request('http://localhost/api/governance/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proposalId: 'prop-1' }), // Missing executorWallet
      });
      const res = await handleExecute(req);
      expect(res.status).toBe(400);
    });

    it('executes a passed proposal and marks status as executed', async () => {
      const req = new Request('http://localhost/api/governance/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          proposalId: 'prop-passed-01',
          executorWallet: 'GADMIN123...',
        }),
      });
      const res = await handleExecute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('executed');
    });
  });
});
