# Baraza — Higgsfield Brand Teaser (30s)

A 6-shot, ~30s cinematic reel intended to play before or alongside the live demo screen recording. Atmospheric, ground-truth imagery of Kenyan community life cross-cut with phones showing the Baraza dashboard. No spoken narration; music + on-screen lower thirds carry the story.

> **Target spec**
> - **Length:** 30s total (6 shots × 5s each)
> - **Aspect:** 16:9 (use 9:16 variants in the shot list for socials)
> - **Resolution:** 1080p
> - **Models:** [`higgsfield-ai/soul/standard`](https://docs.higgsfield.ai/docs) for the source stills, [`higgsfield-ai/dop/preview`](https://docs.higgsfield.ai/docs) for image-to-video
> - **Pipeline:** Soul image → DoP animation → ffmpeg concat → music overlay → title cards in post

## Pre-flight

1. Sign up at [higgsfield.ai](https://higgsfield.ai/) and create an API key in **Settings → API**. You get **two values**: an API key and an API key secret — both go into the auth header as `Key {key}:{secret}`.
2. Copy `.env.example` → `.env.local` in `app/` and fill in:
   ```
   HIGGSFIELD_API_KEY=hf_xxx
   HIGGSFIELD_API_KEY_SECRET=hf_sec_xxx
   ```
3. Install ffmpeg locally (`winget install ffmpeg` on Windows). The render script doesn't need it; the stitch step at the end does.
4. Run: `node app/scripts/higgsfield/render.mjs`. The script generates a still per shot, animates each into a 5s clip, downloads everything to `app/scripts/higgsfield/output/`, and prints the final ffmpeg concat command.

---

## Shot list

Each shot has two prompts:
- **Image prompt** → fed to Soul to generate the source still (photorealistic, cinematic).
- **Motion prompt** → fed to DoP with the resulting `image_url` to produce the 5s clip with the named camera move.

### Shot 1 — Hands counting cash (0:00–0:05)

> *Open on hands, ledger, the texture of physical money.*

- **Image prompt:** *"Close-up of weathered hands counting a stack of Kenyan 1000-shilling notes on a worn wooden table, warm afternoon light streaming from a window, a small spiral notebook with hand-written tallies just out of focus, depth of field shallow at f/2.0, 35mm film grain, color palette of warm ochre and deep brown, anthropological photography, Magnum Photos style."*
- **Motion prompt:** *"Slow push-in on the hands, money stack slightly compressing as a note is laid down, subtle paper rustle implied, no camera shake, hands stay in frame."*
- **Aspect:** 16:9 • **Resolution:** 1080p

### Shot 2 — Group meeting around a ledger (0:05–0:10)

> *The room of human deliberation that Baraza digitizes.*

- **Image prompt:** *"Five Kenyan women in their thirties to fifties gathered around a wooden table on an open verandah, one pointing at an open A4 ledger book, animated mid-discussion, late afternoon sun warming the scene, headscarves and bright kitenge fabric, candid editorial documentary style, shallow depth of field, soft bokeh of greenery beyond the verandah, 50mm lens look, Kodak Portra 400 color grade."*
- **Motion prompt:** *"Handheld feel, very gentle drift left to right, one woman gestures emphatically, another nods, soft natural movement, no zoom."*
- **Aspect:** 16:9 • **Resolution:** 1080p

### Shot 3 — M-Pesa confirmation on a phone (0:10–0:15)

> *The fiat rail meets the platform.*

- **Image prompt:** *"Macro close-up of a hand holding a budget Android smartphone in portrait, screen showing a green SMS notification panel that reads 'Confirmed. Ksh 500 sent to BARAZA POOL on 18/5/26' in clean sans-serif text, blurred market stall colors behind, late golden hour, cinematic clean key light on the screen, photorealistic, no fake fingers, no UI artifacts."*
- **Motion prompt:** *"Slow push-in on the phone screen, hand stays steady, slight breathing of the background bokeh, no rack focus."*
- **Aspect:** 16:9 • **Resolution:** 1080p
- **Note:** The exact SMS text is hard for any generator to render legibly. If it comes back garbled, regenerate with a shorter on-screen string like *"Confirmed. Ksh 500."* or composite the text in post with ffmpeg `drawtext`.

### Shot 4 — Wide chama gathering under acacia (0:15–0:20)

> *The room scales — this is the audience.*

- **Image prompt:** *"Wide establishing shot of a community savings group of 25 people seated in a loose circle under a large spreading acacia tree, golden hour light filtering through the canopy, dusty red earth, a chairperson standing addressing the group with one arm raised, plastic chairs and a small wooden table at center, the Kenyan countryside extending behind, anamorphic widescreen look, deep saturation, Roger Deakins lighting, depth, scale."*
- **Motion prompt:** *"Slow dolly forward toward the circle, treetops sway gently in the breeze, one figure in the circle turns their head, otherwise static composition, cinematic patience."*
- **Aspect:** 16:9 • **Resolution:** 1080p

### Shot 5 — Phone showing a dashboard (0:20–0:25)

> *The bridge shot: physical money → digital truth.*

- **Image prompt:** *"Over-the-shoulder shot of a young Kenyan man holding a smartphone in portrait, screen displays an abstract financial dashboard with a large green KSh balance number, a horizontal vote progress bar in yellow and green, and three small avatar circles, dark navy app background with warm yellow accent color, clean modern UI sans-serif text, defocused market alley in the background with warm sodium light, cinematic, 35mm, photorealistic, no spelling errors on screen elements."*
- **Motion prompt:** *"Slight handheld breathing, the screen content stays still, the man's thumb scrolls upward by a small amount, background traffic blur shifts subtly."*
- **Aspect:** 16:9 • **Resolution:** 1080p
- **Note:** Higgsfield will not render the actual Baraza UI accurately. We get an evocative *suggestion* of a dashboard. If you want the real UI on screen, capture a screen recording at 1080p and composite it onto the phone in post (After Effects corner-pin or DaVinci Resolve Fusion).

### Shot 6 — Sunset skyline title card (0:25–0:30)

> *Land the brand.*

- **Image prompt:** *"Wide silhouette of the Nairobi skyline at dusk, deep indigo sky transitioning to molten orange at the horizon, KICC tower and surrounding buildings as recognizable silhouettes, a flock of birds in mid-flight, low foreground out of focus, room for text overlay in the upper third, cinematic 2.39:1 framing, hyper-real, Christopher Doyle color palette."*
- **Motion prompt:** *"Slow truck right, parallax between near silhouettes and distant skyline, birds drift across frame, gentle ambient motion, no camera shake."*
- **Aspect:** 16:9 • **Resolution:** 1080p
- **Title overlay (post):** *"Baraza — built for the room that already exists."* Render with ffmpeg `drawtext` or in CapCut on top of this clip.

---

## Stitching (ffmpeg)

After the render script downloads `shot_01.mp4` through `shot_06.mp4` to `app/scripts/higgsfield/output/`:

```bash
cd app/scripts/higgsfield/output

# 1. Build concat list
printf "file 'shot_01.mp4'\nfile 'shot_02.mp4'\nfile 'shot_03.mp4'\nfile 'shot_04.mp4'\nfile 'shot_05.mp4'\nfile 'shot_06.mp4'\n" > concat.txt

# 2. Lossless concat (all clips share codec from Higgsfield, no re-encode needed)
ffmpeg -f concat -safe 0 -i concat.txt -c copy baraza-teaser-no-audio.mp4

# 3. Add a music bed (drop any 30s mp3 into ./music.mp3 first; -shortest trims to video length)
ffmpeg -i baraza-teaser-no-audio.mp4 -i music.mp3 -c:v copy -c:a aac -shortest baraza-teaser-30s.mp4
```

For the title card on shot 6, replace step 2 with a filtergraph that calls `drawtext` over the last 5s segment, or just do it in CapCut — faster.

## Suggested music

A 30s loop that fits: warm percussive Afrobeat with a calm pulse, no dominant vocal, builds gently in the last 10s. Search "Afrobeat instrumental cinematic" on Artlist / Epidemic Sound / Musicbed. Avoid YouTube Audio Library generics — they read as stock.

## Cost estimate

Higgsfield pricing is credit-based and changes; check [higgsfield.ai/pricing](https://higgsfield.ai/) for current rates. Rough order of magnitude as of May 2026:
- Soul standard image: ~10 credits each × 6 = 60
- DoP preview 5s video: ~50 credits each × 6 = 300
- **Total: ~360 credits per full render** (≈ $4–8 USD depending on plan)

Plan to render each shot 2–3× to pick the best take. Budget **~$15–25** for a finished teaser.

## Cuts if you need shorter

Drop in this order, each cut saves 5s and one render pair:
1. **Shot 4 (chama under acacia)** — visually beautiful but conceptually overlapping with shot 2.
2. **Shot 6 (sunset skyline)** — replace with a black card + drawtext for the title.
3. **Shot 2 (group meeting)** — keep shot 4 instead.

A 20s cut runs shots 1, 3, 5, 6.

## Cuts if you need vertical (9:16, socials)

Re-run the same prompts with `aspect_ratio: "9:16"` and reframe shots 1, 3, 5, 6 (they're already portrait-friendly). Shots 2 and 4 will lose composition — re-prompt with *"vertical composition, subject centered"* added.
