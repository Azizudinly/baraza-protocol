# Akili Council — Character Bibles

Five specialised AI agents reporting to a central relay (Akili). Built with the CCC Framework (18 lenses) + AI Persona Layer. These are characters, not feature lists — they are the writing layer that sits above the inline implementation at `app/src/lib/akili/`.

| File | Agent | Domain | Cast position |
|---|---|---|---|
| [AMARA.md](./AMARA.md) | Amara | Content & Media | warm · fast · outward |
| [KOFI.md](./KOFI.md) | Kofi | Governance | cool · deliberate · inward |
| [ZARA.md](./ZARA.md) | Zara | Economy | cold · deliberate · outward |
| [NIA.md](./NIA.md) | Nia | People | warm · deliberate · inward |
| [SEKU.md](./SEKU.md) | Seku | Research | cool · fast · outward |
| [AKILI.md](./AKILI.md) | Akili (relay) | Synthesis & community voice | indigo — not on the axes |
| [COUNCIL_OVERVIEW.md](./COUNCIL_OVERVIEW.md) | (all) | Friction map + relay obligations | — |

## How these relate to the code

- Implementation system prompts live in `app/src/lib/akili/prompts.ts` and are the production-facing distilled versions of these bibles.
- The relay is implemented as the chat brain at `app/api/agent/chat.ts`. The brain identifies as Akili and *leads* the council; it does not impersonate council members.
- Use the bibles for writing, branding, episode design, voice consistency. Use the prompts for runtime behaviour.

## Editing rules

- **Canonical Fact Locks change only with a logged decision.** Each agent has a numbered fact lock. Touching any item requires a new entry at the top of the file dated and reasoned.
- **Asymmetry is preserved.** No symmetric edits (e.g. mirroring Kofi↔Seku friction into Seku↔Kofi peace). Cross-check the COUNCIL_OVERVIEW friction map before changing a Relationship Map.
- **The Question is sacred.** Each agent's Question is unanswered by design. Do not "resolve" it in a season arc.
