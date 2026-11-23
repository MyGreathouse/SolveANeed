# SolveANeed — Image Placement Plan

All 12 images were supplied by the founder. They were converted to WebP (≤1600 px wide, about 1.8 MB total) in `public/images/` and are served through `next/image` (AVIF/WebP, responsive sizes). Every placement has descriptive alt text. The brand banner is also used as the 1200×630 social-sharing image (`public/og-image.jpg`).

| Slot (directive §3) | File | Used on |
|---|---|---|
| 1. Homepage hero | `give-support.webp` | Homepage hero; How It Works › Give |
| 2. Giving | `community.webp` | Homepage “Give help your way”; /give hero; Get Started (help path) |
| 3. Paid tasks | `earn-inclusive.webp`, `earn-tasks.webp` | Homepage “Earn support with dignity”; /earn hero; How It Works › Earn |
| 4. Milestone funding | `fund-milestones.webp` | How It Works › Fund, **captioned “Illustration only”** |
| 5. Direct solutions | `solve-direct.webp` | How It Works › Solve |
| 6. Trust and verification | — | Icon-led section (no suitable photo supplied) |
| 7. Business sponsorship | `solve-direct.webp` | Homepage Business Partnerships; /businesses hero |
| 8. Community outcomes | `community.webp` | See slot 2 (no real outcomes exist yet) |
| 9. Mobile onboarding | `mobile-onboarding.webp` | Sign-in/sign-up side panel; homepage final call to action |
| Categories | `explore-categories.webp` | How It Works hero; Get Started (need path) |
| Social share | `brand-banner.webp` → `og-image.jpg` | Open Graph / Twitter card |

## Supplied but deliberately not used (founder decision needed)

| File | Reason |
|---|---|
| `fund-couple.webp`, `fund-mobile.webp` | They show specific funding figures (“£7,200 of £10,000”, “72%”). The directive forbids invented funding statistics, so they shouldn't appear as if real. Use them only with an “Illustration” caption, or replace them. |
| `paid-tasks-local.webp` | Shows “Find Local Tasks” with a tradesperson, but the directive limits early tasks to **low-risk remote work**. Hold back until in-person tasks are approved. |

## Notes for future artwork
- Several images have the logo with a **®** mark. Check the trade mark is actually registered before showing ®, or ask the designer to remove it.
- Images with text baked in (banner, overlays) aren't accessible as text. The site always repeats the key message in real HTML.
- No real users, testimonials or outcomes are shown. Replace stock scenes with consented member stories only once outcomes are confirmed.
