#!/usr/bin/env node
/**
 * Baraza dev-swarm agent runner.
 * Called by .github/workflows/agent-swarm.yml for each review type.
 * Usage: node scripts/agents/review.mjs <seo|design|security|code>
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const AGENT = process.argv[2] ?? process.env.AGENT;
if (!['seo', 'design', 'security', 'code'].includes(AGENT)) {
  console.error(`Unknown agent: ${AGENT}`);
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set — skipping review');
  process.exit(0);
}

const DIFF_PATH = '/tmp/pr.diff';
let diff = '';
try {
  diff = readFileSync(DIFF_PATH, 'utf8').slice(0, 60_000); // cap at 60k chars
} catch {
  console.error('Could not read PR diff');
  process.exit(1);
}

if (!diff.trim()) {
  console.log('Empty diff — nothing to review');
  process.exit(0);
}

const PERSONAS = {
  seo: {
    emoji: '🔍',
    title: 'SEO',
    prompt: `You are a senior SEO engineer reviewing a Vite React SPA called Baraza Protocol (barazaprotocol.com).

Focus only on SEO-relevant changes in this PR diff:
- Missing or wrong <title>, <meta name="description">, og:title, og:image, og:description tags
- React Router pages with no <head> management (no react-helmet or equivalent)
- Images missing alt text
- Non-semantic HTML (div soup instead of article/section/nav/main/h1-h6)
- Client-side-only rendering of critical content that crawlers won't see
- Broken or missing canonical URLs, sitemap entries, robots.txt rules
- Anchor tags with non-descriptive text ("click here", "learn more")

Ignore: Tailwind classes, minor style changes, test files, types, non-page files.

If no SEO issues exist in this diff, say so in one sentence.`,
  },

  design: {
    emoji: '🎨',
    title: 'Design',
    prompt: `You are a senior UI/UX designer reviewing a Tailwind CSS React app for African community groups (chamas, SACCOs, DAOs). The design system uses CSS variables, font-display, and a warm/primary colour scheme.

Focus only on design issues in this PR diff:
- Low colour contrast (text on background, button labels) — flag anything below WCAG AA
- Missing focus-visible styles on interactive elements
- Hardcoded colours/sizes instead of design tokens (e.g. text-[#FFB300] instead of text-primary)
- Broken responsive layouts (missing sm:/md:/lg: breakpoints where needed)
- Missing aria-label on icon-only buttons/links
- Inconsistent spacing (mixing px values and Tailwind scale)
- Touch targets smaller than 44x44px on mobile (especially buttons)
- Animations or transitions missing reduced-motion media query respect

If no design issues exist in this diff, say so in one sentence.`,
  },

  security: {
    emoji: '🔒',
    title: 'Security',
    prompt: `You are a security engineer reviewing a TypeScript/React app that handles real financial transactions (M-Pesa, Stellar XLM, BRZA token) for African community groups. The app uses Supabase, Cloudflare API routes, and HMAC-signed payment intents.

Focus on real security issues in this PR diff — OWASP Top 10 and finance-specific risks:
- Secrets, API keys, private keys, or seed phrases hardcoded or logged
- SQL injection / Supabase query building with unescaped user input
- Missing authentication/authorisation checks on API routes
- XSS vulnerabilities (dangerouslySetInnerHTML, unsanitised user content)
- IDOR (accessing another user's orders/memberships by guessing IDs)
- Timing attacks in secret comparison (use crypto.timingSafeEqual, not ===)
- CSRF — missing origin/CORS validation on state-mutating endpoints
- Insecure direct object references in payment_orders or memberships
- Intent token or activation secret leakage in logs, responses, or client code
- Rate-limit bypass risks on payment or auth endpoints

If no security issues exist in this diff, say so in one sentence. Do NOT flag theoretical or highly unlikely issues — only real, demonstrable risks.`,
  },

  code: {
    emoji: '🛠️',
    title: 'Code',
    prompt: `You are a senior TypeScript/React engineer reviewing a Vite + React SPA with Cloudflare API routes. The project uses strict TypeScript, vitest, Tailwind CSS, Supabase, Stellar SDK, and Solana web3.js.

Focus on real code quality issues in this PR diff:
- TypeScript type errors or unsafe any/unknown usage that bypasses type safety
- React hooks rule violations (conditional hooks, stale closures, missing deps)
- Memory leaks (event listeners or async ops not cleaned up)
- Unhandled promise rejections or missing error boundaries on async paths
- Incorrect use of useEffect dependencies causing infinite re-renders
- Dead code, duplicate logic, or obvious copy-paste errors
- Breaking changes to existing API contracts (route signatures, return shapes)
- Test coverage gaps for new business logic (payment flows, state machines)
- import cycle risks or importing server-only code into client bundles
- console.log/debug statements left in production paths

Do NOT flag: style preferences, naming conventions, missing comments, minor abstractions. Only flag things that will cause bugs or degrade reliability.`,
  },
};

const { emoji, title, prompt } = PERSONAS[AGENT];

// Call Anthropic API via fetch (no npm install needed in CI)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\n---\nPR Diff:\n\`\`\`diff\n${diff}\n\`\`\`\n\nProvide your review as a concise markdown list. Group findings by severity: 🔴 Critical, 🟠 Major, 🟡 Minor. If nothing found, say so in one sentence.`,
      },
    ],
  }),
});

if (!response.ok) {
  console.error(`Anthropic API error: ${response.status} ${response.statusText}`);
  process.exit(0); // Don't block CI on agent failure
}

const data = await response.json();
const review = data.content?.[0]?.text ?? '(no output)';

const prNumber = process.env.PR_NUMBER;
const repo = process.env.REPO;

const commentBody = `## ${emoji} ${title} Agent Review

${review}

---
<sub>Generated by Baraza dev swarm · [agent-swarm.yml](/.github/workflows/agent-swarm.yml)</sub>`;

// Post as PR comment
try {
  execSync(
    `gh pr comment ${prNumber} --repo ${repo} --body ${JSON.stringify(commentBody)}`,
    { env: { ...process.env }, stdio: 'inherit' }
  );
} catch (err) {
  console.error('Failed to post comment:', err.message);
  // Print review to stdout as fallback
  console.log(commentBody);
}
