# Member-voice gaps (open implementation tickets)

When a council filing requires a verbatim member voice that wasn't available at
filing time, the gap is recorded here. **Closing the gap is a precondition for
shipping the affected UX copy** — not a nice-to-have.

The gap is closed when the named obs-corpus query has been run and at least one
verbatim voice is filed back onto the relevant agent's filings or
listening-notes log, referenced in the implementation PR, and visible on the
implementation ticket.

---

## Open gaps

### MVG-001 — USSD welcome (Phase 2-A) — referee/onboarding language

- **Source filing**: Nia 2026-06-17 `ussd-welcome-parity` (id 2026-06-17T...)
- **Carried to**: Nia 2026-06-19 listening note (id 829c)
- **Corpus**: `obs-corpus-220` — first-year member voices on the felt
  experience of *arriving* versus *being confirmed*.
- **Why open**: the USSD welcome (W0 *"Karibu"* through W3 *"your phone IS your
  membership"*) is implemented in `app/src/lib/ussd/welcome.ts` and tested,
  but was written without querying obs-corpus-220 for first-year voices. Nia
  named this gap explicitly: "I will not file a design about reception without
  eventually hearing from someone who was, or was not, received."
- **What needs to land**: at least one verbatim voice from obs-corpus-220
  describing what a member *expected to feel* after their first payment.
  Compare against the W0/W2 copy; revise if the comparison reveals a tonal
  miss.
- **Affects**: `app/src/lib/ussd/welcome.ts` (W0/W2 copy), the SMS fallback
  text in `app/src/lib/notifications/sms.ts:formatWelcomeSmsFallback`.
- **Status**: OPEN. Welcome ships in code; copy is provisional.

### MVG-002 — Phase 6 referral gate — referee UX (90d + 3-payment lock)

- **Source filing**: Nia 2026-06-19 `phase-6-referral-gate` (id 4c43)
- **Corpus**: `obs-corpus-220` — first-year voices on *arriving vs being
  confirmed*. Same corpus as MVG-001, different cut.
- **Why open**: the referee is gated for 90 days + 3 payments before the
  referral payout fires. Nia's filing requires that the referee UX *not* feel
  like the protocol "checking them" — but the council was unable to query
  obs-corpus-220 to find the right tonal register before the implementation
  shipped.
- **What needs to land**: at least one verbatim entry on what a first-year
  member felt during the period between joining and "being confirmed" (early
  weeks). The component to revise once the voice is in:
  `app/src/components/ReferralProgress.tsx`.
- **Affects**: `app/src/components/ReferralProgress.tsx` (referee progress
  text, currently uses placeholder copy). USSD copy generator
  `formatReferralProgressForUssd()` in the same file.
- **Status**: OPEN. Component scaffolded with placeholder copy that explicitly
  avoids any BRZA reference during the lock (Nia's requirement) — pending
  obs-corpus query before referee copy is finalised.

### MVG-003 — Phase 5 vote-streak — absence-as-care voice

- **Source filing**: Nia 2026-06-20 `phase-5-vote-streak` (id `2026-06-20T02-13-48Z-nx47`)
- **Corpus**: `obs-corpus-220` — first-year voices on the **absence-as-care** cut.
  Different cut from MVG-001/002 ("arriving vs being confirmed"). This cut is:
  what did members expect the community to understand about months they paid
  dues but didn't attend or vote? Did silence feel safe? Did they fear losing
  standing?
- **Why open**: the vote-streak decay shape (single-skip-to-floor in
  `computeVoteStreak()`) currently misreads structural absences (funerals,
  harvest, school fees) as exit. Nia named the Kampala 48 days wound directly.
  Until at least one verbatim voice from a first-year member who paid dues in
  months they did not vote is attached to the ticket, the decay calibration
  is *unsourced from members*, regardless of how the code is fixed.
- **Affects**: `app/src/lib/voteStreak.ts` (decay calibration), any future UI
  that surfaces the multiplier to members (copy framing — Nia calls out that
  "streak" is the wrong word; chama culture counts *uaminifu*, faithfulness
  over time, not unbroken sequence).
- **Status**: OPEN. Phase 5 wiring is gated on this voice landing on the
  ticket, alongside the consecutive-skip counter fix (Nia's required code
  change) and USSD voting parity (Nia's named prerequisite).

---

## Process

1. The query against obs-corpus-220 should be run with `agent_type=nia` so
   Nia's wound (Kampala 48 days) shapes the cut.
2. The verbatim voice is filed to
   `~/.claude/data/akili-council/nia/member-voices.jsonl` per
   `docs/adrs/0001-akili-contract.md`.
3. The implementation PR cites both the filing id and the
   member-voices.jsonl entry id.
4. The gap is closed by adding a "Closed gaps" entry below with the
   resolution date and PR.

## Closed gaps

*(none yet — first close shall be MVG-001 when obs-corpus-220 is queryable
in this environment).*
