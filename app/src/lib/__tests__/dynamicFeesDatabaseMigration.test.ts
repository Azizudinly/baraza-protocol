import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../supabase/migrations');
const MIGRATION_024_PATH = resolve(MIGRATIONS_DIR, '024_communities_dynamic_activation_fee.sql');

function readMigration024(): string {
  return readFileSync(MIGRATION_024_PATH, 'utf-8');
}

function extractFeeTypeCheckValues(sql: string): string[] {
  const match = sql.match(/CHECK\s*\(\s*fee_type\s+IN\s*\(([\s\S]*?)\)\s*\)/i);
  if (!match) throw new Error('fee_type check constraint not found in migration 024');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

describe('Database Migration 024: Communities Dynamic Activation Fee', () => {
  it('exists with correct sequential numbering discipline', () => {
    const files = readdirSync(MIGRATIONS_DIR).sort();
    expect(files).toContain('024_communities_dynamic_activation_fee.sql');
    
    // Ensure no duplicate 024_* migration exists
    const matches024 = files.filter((f) => f.startsWith('024_'));
    expect(matches024).toHaveLength(1);
  });

  it('adds activation_fee_minor as BIGINT NOT NULL DEFAULT 0', () => {
    const sql = readMigration024();
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+activation_fee_minor\s+BIGINT\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  });

  it('enforces CHECK constraint for fee_type covering one_time, recurring_monthly, and free', () => {
    const sql = readMigration024();
    const values = extractFeeTypeCheckValues(sql);
    expect(new Set(values)).toEqual(new Set(['one_time', 'recurring_monthly', 'free']));
  });

  it('adds carrier_pass_through as BOOLEAN NOT NULL DEFAULT true', () => {
    const sql = readMigration024();
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+carrier_pass_through\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+true/i);
  });

  it('adds currency as TEXT NOT NULL DEFAULT KES', () => {
    const sql = readMigration024();
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+currency\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'KES'/i);
  });

  it('includes explanatory COMMENT documentation on all added columns', () => {
    const sql = readMigration024();
    expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+communities\.activation_fee_minor\s+IS/i);
    expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+communities\.fee_type\s+IS/i);
    expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+communities\.carrier_pass_through\s+IS/i);
    expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+communities\.currency\s+IS/i);
  });
});
