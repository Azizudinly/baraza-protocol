# Baraza Brand Guidelines v1.0

> **Baraza** (Swahili) — *a public meeting place; a council.*  
> A platform where African communities pool funds, make collective decisions, and govern themselves on-chain.

---

## 1. Logo

### Mark
The Baraza logomark is a council gathered around a shared fire. The three people represent community participation, the crowned center figure represents accountable coordination, and the fire represents a visible shared treasury and common purpose.

### Usage rules
- Always use the versioned SVG (`/baraza-logo-v2.svg`) through the `<BrandLogo />` component
- Use `/brza-token-logo.svg` for BRZA token metadata, wallet listings, and token-specific surfaces
- Minimum size: 28px icon / 16px wordmark
- Never stretch, rotate, recolour, or add drop shadows to the mark
- Clear space = 1x the icon width on all sides

### Variants
| Variant | When to use |
|---------|-------------|
| `iconOnly` | Favicons, app icons, tight spaces |
| `sm` (default) | Navigation header |
| `md` | Marketing materials, cards |
| `lg` | Splash screens, hero sections |

---

## 2. Colour Palette

The active app palette follows the Coolors sequence:

```text
#8ECAE6 -> #219EBC -> #023047 -> #FFB703 -> #FB8500
```

### Primary And Secondary
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--primary` | `#8ECAE6` | `199 65% 73%` | Primary CTAs, focus rings, active states, sky highlights |
| `--secondary` | `#219EBC` | `193 70% 43%` | Supporting CTAs, links, icon accents, teal highlights |

### Accent (Community Gold)
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--accent` | `#FFB703` | `44 100% 50%` | Primary CTA buttons, fund amounts, celebration |
| `--orange` | `#FB8500` | `33 97% 49%` | Alerts, energy, gradient pair with gold |

### Neutrals
| Token | Hex | HSL | Usage |
|-------|-----|-----|-------|
| `--background` | `#023047` | `200 97% 14%` | Page background |
| `--card` | `~#093B58` | `200 79% 17%` | Card surfaces |
| `--surface` | `~#0D4560` | `200 74% 19%` | Input backgrounds, hover surfaces |
| `--foreground` | `~#D9F0F8` | `199 65% 92%` | Primary text |
| `--muted-foreground` | `~#8FC8DD` | `199 45% 68%` | Secondary text, placeholders |

### Gradients
```
Primary:  linear-gradient(135deg, #8ECAE6 -> #219EBC)
Warm CTA: linear-gradient(135deg, #FFB703 → #FB8500)
Hero:     radial-gradient at top + linear navy fade
```

### Accessibility
All text/background combinations should meet **WCAG AA** (4.5:1 minimum contrast). The primary sky on dark navy background has strong contrast and should remain the default for active/focus states.

---

## 3. Typography

### Typefaces
| Role | Family | Weight | Usage |
|------|--------|--------|-------|
| **Display** | Unbounded | 600–800 | All headings (h1–h6), logo wordmark |
| **Body** | DM Sans | 400–600 | Body copy, UI labels, inputs |

### Type Scale
| Token | Size | Weight | Leading | Usage |
|-------|------|--------|---------|-------|
| Hero H1 | 4rem–7rem | 700 | 1.1 | Landing hero |
| Section H2 | 3rem–4rem | 700 | 1.2 | Section headings |
| Card H3 | 1rem | 600 | 1.4 | Card titles |
| Body large | 1.125rem | 400 | 1.7 | Hero subtitles |
| Body | 0.875rem | 400 | 1.6 | General copy |
| Caption | 0.75rem | 400 | 1.5 | Stats, labels, badges |
| Micro | 0.625rem | 600 | 1.4 | Uppercase tracking labels |

### Uppercase labels
Use `text-[10px] uppercase tracking-widest font-semibold text-primary` for section labels (e.g. "PLATFORM FEATURES", "DISCOVER").

---

## 4. Spacing & Layout

### Grid
- **Container max-width:** 1280px (xl), centred with `1rem` side padding
- **Gutter:** 1rem (mobile) → 1.5rem (md+)
- **Section vertical padding:** `py-16` (compact), `py-24` (standard), `py-32` (hero)

### Border radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.875rem` | Default (cards, inputs, modals) |
| `rounded-2xl` | `1rem` | Feature cards, video frames |
| `rounded-3xl` | `1.5rem` | CTA container, hero elements |
| `rounded-full` | `9999px` | Badges, pills, avatar circles |

---

## 5. Elevation & Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 24px -4px hsl(200 97% 6% / 0.55)` | Default cards |
| `--shadow-glow` | `0 0 40px hsl(193 70% 43% / 0.18)` | Active/hover states |
| `--shadow-warm` | `0 4px 24px hsl(44 100% 50% / 0.28)` | Gold CTA hover |
| `--shadow-deep` | `0 20px 60px -10px hsl(200 97% 6% / 0.8)` | Hero video card |

---

## 6. Components

### Buttons
| Class | Background | Usage |
|-------|-----------|-------|
| `btn-warm` (ShimmerButton) | Gold → Orange gradient | Primary action (Start a Group) |
| `btn-primary` | Teal → Sky gradient | Secondary action |
| `btn-ghost` | Transparent + border | Tertiary/cancel |

### Cards
| Class | Style | Usage |
|-------|-------|-------|
| `baraza-card` | Dark card + border + shadow | General content |
| `glass-surface` | Frosted glass `backdrop-blur` | Header, overlays |
| `MagicCard` | Spotlight mouse-follow effect | Community cards, feature cards |
| `BentoCard` | Grid layout item | Features section |

---

## 7. Motion & Animation

### Principles
- **Purposeful** — every animation communicates state or guides attention
- **Fast** — most transitions: `150–300ms`; entrances: `400–500ms`
- **Easing** — use `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out) for most

### Named animations
| Name | Duration | Use |
|------|----------|-----|
| `animate-fade-up` | 500ms | Section entrance |
| `animate-fade-in` | 300ms | Modal open |
| `animate-float` | 6s infinite | Decorative elements |
| `animate-pulse-glow` | 3s infinite | Border glow on featured cards |
| `animate-marquee` | 35–40s infinite | Community marquee |
| `animate-shining` | 8s infinite | Shiny text badge |
| WordRotate | 2.8s interval | Hero headline rotation |
| NumberTicker | spring(60, 100) | Stats counter |

---

## 8. Voice & Tone

| Principle | Description | Example |
|-----------|-------------|---------|
| **Community-first** | Speak to "your group", not "the platform" | "Your Chama runs on Baraza" |
| **Clear, not technical** | No blockchain jargon unless necessary | "On-chain" ✓, "Smart contracts" ✓, "Merkle trees" ✗ |
| **Warm & optimistic** | African Ubuntu philosophy — "I am because we are" | "Communities thriving right now" |
| **Precise with numbers** | Always show KSh values clearly | "KSh 234,500 Fund" |

---

## 9. Imagery (Higgsfild nano_banana_2 Prompts)

Once Higgsfild credits are available, generate these assets with `model: nano_banana_2`:

```
Hero thumbnail:
"A diverse group of East African community members sitting together outdoors,
warm afternoon sunlight, some holding phones, animated discussion, vibrant
clothing, documentary photography style, shallow depth of field, 16:9, 4K"

Community card avatars (run ×6 with variations):
"Abstract geometric African pattern rendered as a community badge icon,
teal and gold color palette, dark navy background, flat design, 1:1, 4K"

Feature section background:
"Minimalist dark navy abstract background with subtle geometric node network,
glowing teal connection lines, no people, 16:9, 4K"
```

---

## 10. Prohibited Uses

- Do not use the logo on backgrounds with < 3:1 contrast
- Do not use comic/display fonts other than Unbounded
- Do not use bright white backgrounds — the brand is dark-first
- Do not modify the gold CTA gradient — it must remain `#FFB703 → #FB8500`
- Do not add more than 2 gradients per screen section

---

*Baraza Brand Guidelines — maintained by the Baraza design team. Last updated: May 2026.*
