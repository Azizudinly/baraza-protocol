import { describe, expect, it } from 'vitest';
import { getCoopTemplate, listCoopTemplates, type CommunityType } from '@coop-templates';

const ALL_TYPES: CommunityType[] = ['chama', 'sacco', 'stokvel', 'dao', 'government'];

describe('coop-templates', () => {
  it('ships a template for every CommunityType it declares', () => {
    for (const type of ALL_TYPES) {
      const template = getCoopTemplate(type);
      expect(template.type).toBe(type);
      expect(template.label.length).toBeGreaterThan(0);
      expect(template.memberLimit).toBeGreaterThan(0);
      expect(template.quorum).toBeGreaterThan(0);
    }
  });

  it('lists exactly the 5 templates it defines, matching getCoopTemplate 1:1', () => {
    const listed = listCoopTemplates();

    expect(listed).toHaveLength(ALL_TYPES.length);
    for (const type of ALL_TYPES) {
      expect(listed.find((t) => t.type === type)).toEqual(getCoopTemplate(type));
    }
  });
});
