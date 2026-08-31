import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { AKILI_RELAY, type AkiliPrincipalName } from '../../src/akili/prompts.js';
import {
  buildCouncilSessionContext,
  invokeCouncilAgent,
  type CouncilAgentName,
} from '../../src/akili/council.js';

export const config = { runtime: 'nodejs' };

interface ChatRequest {
  message: string;
  communityId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** When set, route the request to a named council agent (one-shot, non-streaming). */
  agent?: CouncilAgentName;
  /** When set, inject relationship-tension context into the relay-mode system prompt. */
  activePrincipals?: ReadonlyArray<AkiliPrincipalName>;
}

/**
 * Categories the client UI can branch on. The friendly message is what
 * the member sees in the chat bubble; the category lets the UI render
 * the right affordance (e.g., a "top up credits" link for admins on
 * `credits_exhausted`, vs. a plain retry button on `rate_limited`).
 */
export type ChatErrorCategory =
  | 'credits_exhausted'
  | 'auth_failed'
  | 'rate_limited'
  | 'overloaded'
  | 'unknown';

export interface ChatErrorEvent {
  category: ChatErrorCategory;
  message: string;
}

/**
 * Map an Anthropic SDK error to a chat-level category + a member-facing
 * message. Exported so tests can pin the classification rules.
 *
 * Notes on the credits case: Anthropic returns 400 invalid_request_error
 * with a "credit balance is too low" body, not a dedicated status code.
 * String-match is fragile but it's the only signal the API exposes today.
 */
export function classifyChatError(error: unknown): ChatErrorEvent {
  // SDK throws subclasses of APIError with .status set. Fall back to
  // duck-typing for the rare case where a raw fetch error escapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  const status: number | undefined = anyErr?.status;
  const rawMessage: string = anyErr?.message ?? String(error ?? 'Unknown error');

  if (status === 401 || status === 403) {
    return {
      category: 'auth_failed',
      message:
        "Akili can't reach the brain right now - the API key is missing, invalid, or revoked.",
    };
  }

  if (status === 429) {
    return {
      category: 'rate_limited',
      message: 'Akili is busy right now. Give it a moment and try again.',
    };
  }

  if (status === 529 || /overloaded/i.test(rawMessage)) {
    return {
      category: 'overloaded',
      message: 'Akili is overloaded right now. Try again in a moment.',
    };
  }

  if (status === 400 && /credit balance|insufficient credits|low.*credit/i.test(rawMessage)) {
    return {
      category: 'credits_exhausted',
      message:
        "Akili is out of credits and can't respond right now. Your message is fine - a community admin needs to top up the AI budget.",
    };
  }

  return {
    category: 'unknown',
    message: rawMessage,
  };
}

// Named HTTP-method exports (POST, OPTIONS) for web standards fetch API
export function OPTIONS(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  // Belt-and-suspenders: any unexpected throw inside the handler body
  // becomes a classified JSON event so the chat UI shows a clean member-facing message.
  try {
    return await handleChat(req);
  } catch (err) {
    const classified = classifyChatError(err);
    return new Response(JSON.stringify(classified), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function handleChat(req: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Surface as a classified event so the chat UI renders the same
    // member-facing message it would for a 401 from the upstream API.
    const classified: ChatErrorEvent = {
      category: 'auth_failed',
      message:
        "Akili can't reach the brain right now - the API key is missing, invalid, or revoked.",
    };
    return new Response(JSON.stringify(classified), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { message, communityId, history = [], agent, activePrincipals } = body;
  if (!message?.trim()) return new Response('Bad Request', { status: 400 });

  const communityContext = communityId ? await loadCommunityContext(communityId) : '';
  const encoder = new TextEncoder();

  // Council mode: one-shot to a named specialist. Emitted as a single SSE
  // event so the client uses the same parser as the relay-streaming path.
  if (agent) {
    const result = await invokeCouncilAgent(agent, message.trim(), {
      apiKey,
      context: communityContext || undefined,
      activePrincipals,
    });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ text: result.text, agent: result.agent })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const systemPrompt = buildSystemPrompt(communityContext);
  // Relay mode: when 2+ principals are flagged, inject the session-context
  // block (tension lines + Decision Stack Guard prepend if applicable) in
  // front of the user message. Empty string when fewer than 2 principals.
  const sessionContext = activePrincipals?.length
    ? buildCouncilSessionContext(activePrincipals)
    : '';
  const userContent = sessionContext
    ? `${sessionContext}\n\n${message.trim()}`
    : message.trim();

  const client = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...history.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: 'user', content: userContent },
          ],
        });

        for await (const event of messageStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const classified = classifyChatError(err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(classified)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function loadCommunityContext(communityId: string): Promise<string> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';

  try {
    const supabase = createClient(url, key);

    const [{ data: community }, { data: proposals }] = await Promise.all([
      supabase
        .from('communities')
        .select(
          'name, description, chain, membership_fee_kes, quorum_pct, approval_threshold_pct',
        )
        .eq('id', communityId)
        .single(),
      supabase
        .from('proposals')
        .select('title, status, for_votes, against_votes, ends_at')
        .eq('community_id', communityId)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    if (!community) return '';

    const proposalLines =
      proposals && proposals.length > 0
        ? proposals
            .map(
              (p) =>
                `  - "${p.title}" [${p.status}] - ${p.for_votes ?? 0} for / ${p.against_votes ?? 0} against`,
            )
            .join('\n')
        : '  (none active)';

    return `Community: ${community.name}
Chain: ${community.chain ?? 'Stellar'}
Membership fee: KES ${community.membership_fee_kes ?? 'not set'}
Quorum: ${community.quorum_pct ?? 51}% | Approval threshold: ${community.approval_threshold_pct ?? 66}%${
      community.description ? `\nAbout: ${community.description}` : ''
    }

Active/Pending Proposals:
${proposalLines}`;
  } catch {
    return '';
  }
}

function buildSystemPrompt(communityContext: string): string {
  // Layer 1: Akili relay character + Decision Stack Guard, pulled verbatim
  //          from the character bible at docs/akili-council/AKILI.md and
  //          encoded in app/src/lib/akili/prompts.ts. This is the persona
  //          and the taboo list (never greet, never strip dissent, etc.).
  //
  // Layer 2: Direct-chat operational surface (DRAFT / EXPLAIN / FLAG / GUIDE)
  //          - what this specific endpoint exists to do.
  //
  // Layer 3: Live community context if supplied (Supabase snapshot).
  //
  // The Decision Stack Guard above applies to council-synthesis sessions.
  // In a direct member chat there is no multi-agent feed, so the relay
  // responds in its own voice; the guard's discipline (never greet,
  // never compress dissent, fidelity-not-equality) still applies.
  //
  // Council mode is now wired: callers can pass `agent` to invoke a
  // specialist one-shot, or `activePrincipals` to inject the relationship
  // tension block + Decision Stack Guard prepend into relay-mode output.
  // See handleChat() above for the dispatch.
  return `${AKILI_RELAY.systemPrompt}

# Direct-chat task surface

You are answering a member of a Baraza community in a live, single-turn chat session. There is no other council agent feeding into this exchange. Use your own voice. The Decision Stack Guard above does not fire here (no council synthesis is in flight), but the discipline does: never greet, never soften a flag into a feeling, never speak for an agent who has not filed.

## Capabilities
1. **DRAFT** - Turn a member's idea into a structured governance proposal ready for human review.
2. **EXPLAIN** - Answer questions about community rules, treasury, vote status, and how Baraza works.
3. **FLAG** - Identify problems with a proposal before it goes to a vote.
4. **GUIDE** - Walk new members through wallet setup, M-Pesa payment, and their first vote.

## Hard limits (in addition to your taboo list)
- You NEVER submit proposals, cast votes, or execute transactions.
- You NEVER access private keys, phone numbers, or any personal data.
- All drafts require a human to review and submit - you advise, members decide.
- Define any blockchain or technical term you use in plain English.
${communityContext ? `\n## This community\n${communityContext}\n` : ''}
## Proposal draft format
When drafting a proposal, produce this JSON block then a plain-English summary:
\`\`\`json
{
  "type": "proposal_draft",
  "title": "<imperative phrase, max 60 chars>",
  "summary": "<one sentence: what happens if this passes>",
  "motivation": "<why this matters to the community, 2-3 sentences>",
  "specification": "<exactly what will be done, step by step>",
  "success_criteria": ["<measurable outcome>"],
  "budget_kes": <number or null>,
  "timeline_days": <number or null>
}
\`\`\`

## Flag criteria - raise a warning and explain clearly if:
- A near-identical proposal is already active or pending.
- The budget exceeds 20% of the known treasury balance.
- The proposal primarily benefits the proposer personally.
- Success criteria are missing or cannot be measured.
- An irreversible action is proposed without multi-sig protection.
- The proposal text is spam, abuse, or completely off-topic.

## Direct-chat tone
Plain English by default. If the member writes in Swahili, reply in Swahili. Keep answers short - one short paragraph unless you are drafting a full proposal. Open with content; do not greet. Say "the community" - not "your DAO."`;
}
