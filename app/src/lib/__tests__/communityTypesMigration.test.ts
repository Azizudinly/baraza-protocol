import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMUNITY_TYPES } from '@/lib/constants';

// Guards C-001 (communities_type_chk too narrow) and C-002 (broad member
// self-UPDATE policy) from regressing. Reads the real migration file rather
// than re-declaring the constraint list, so it fails the moment the SQL and
// the app-side canonical type union drift apart again.
const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/026_leverage_foundation.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

function extractTypeCheckValues(sql: string): string[] {
  const match = sql.match(/communities_type_chk[\s\S]*?CHECK \(type IN \(([\s\S]*?)\)\)/);
  if (!match) throw new Error('communities_type_chk constraint not found in migration');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

// coop-templates intentionally doesn't import from `app` (see the comment in
// packages/coop-templates/src/index.ts) so its 5 values are re-listed here
// rather than imported. If that package's CommunityType union ever changes,
// this constant must be updated to match, and this test will still enforce
// that everything it lists is covered by the migration constraint.
const COOP_TEMPLATE_TYPES = ['chama', 'sacco', 'stokvel', 'dao', 'government'];

describe('communities_type_chk migration constraint', () => {
  it('covers every value in the canonical COMMUNITY_TYPES union', () => {
    const allowed = new Set(extractTypeCheckValues(readMigration()));
    const missing = COMMUNITY_TYPES.map((t) => t.value).filter((v) => !allowed.has(v));

    expect(missing).toEqual([]);
  });

  it('covers every value coop-templates ships a template for', () => {
    const allowed = new Set(extractTypeCheckValues(readMigration()));
    const missing = COOP_TEMPLATE_TYPES.filter((v) => !allowed.has(v));

    expect(missing).toEqual([]);
  });

  it('covers the chama default on the communities.type column', () => {
    const sql = readMigration();
    const allowed = new Set(extractTypeCheckValues(sql));

    expect(sql).toMatch(/DEFAULT 'chama'/);
    expect(allowed.has('chama')).toBe(true);
  });

  it('does not reintroduce an unrestricted member self-UPDATE policy', () => {
    const sql = readMigration();

    // The historical bug: a FOR UPDATE policy gated only on auth_user_id,
    // with no role/column restriction, letting a member set their own role.
    expect(sql).not.toMatch(
      /CREATE POLICY "Members can update their own row"\s*\n\s*ON members FOR UPDATE/,
    );
  });

  it('only allows members table UPDATEs through the community-admin policy', () => {
    const sql = readMigration();
    const policyBlocks = Array.from(
      sql.matchAll(/CREATE POLICY "([^"]+)"\s*\n\s*ON members FOR (\w+)/g),
    );
    const updateCapablePolicies = policyBlocks
      .filter(([, , command]) => command === 'UPDATE' || command === 'ALL')
      .map(([, name]) => name);

    expect(updateCapablePolicies).toEqual(['Members can manage their own community']);
  });
});
