# Motion system

Framer Motion is Baraza's canonical interface motion system. Extend the existing `motion`, `AnimatePresence`, and `useReducedMotion` patterns for entrances and state transitions; do not add GSAP or another animation runtime. Motion must preserve keyboard access, honor reduced-motion preferences, and clarify a state change rather than decorate unrelated content.

The current implementation is established in the entry experience, Akili chat, onboarding, decision cards, member views, and the community activity surfaces. CSS transitions remain appropriate for simple hover and focus states.
