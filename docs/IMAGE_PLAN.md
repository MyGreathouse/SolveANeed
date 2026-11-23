# SolveANeed — Image Placement Plan

> **Updated in Phase 2.5** — see "Phase 2.5 review" at the end. The table directly below is the Phase 1 plan and is superseded.

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

---

## Phase 2.5 review (current)

All 12 supplied images were reviewed at full resolution.

| # | File (original) | Spelling | ® | Fictional figures | Baked UI/buttons | Action taken | Now used on |
|---|---|---|---|---|---|---|---|
| 1 | brand banner | ✅ SolveANeed | Yes (tiny) | — | **Yes** (buttons, pillar tiles; off-palette purple) | **Retired.** New 1200×630 social card rendered from live brand components | `og-image.jpg` (new) |
| 2 | explore-categories | ✅ | Yes | — | Category checklist (includes a non-existent category) | ® removed; checklist cropped out | How It Works hero |
| 3 | give-support | ✅ | Yes (shirt, laptop) | — | — | ® removed | Home hero; How It Works › Give |
| 4 | earn-tasks | ✅ | Yes | — | "Earn Through Tasks" panel ("Get Fair and Timely Payment") | Panel cropped out (laptop logo outside crop) | How It Works › Earn |
| 5 | fund-milestones | ✅ | Yes | **67% progress** | Milestone panel | ® removed; panel and figure cropped out | How It Works › Fund; Get Started (need) |
| 6 | solve-direct | ✅ | Yes | — | "Direct Solutions" panel | ® removed; panel cropped out | How It Works › Solve; /businesses |
| 7 | earn-inclusive | ✅ | Yes (hoodie, laptop) | — | "Earn Through Tasks" panel | ® removed; panel cropped out | Home "Earn support"; /earn |
| 8 | paid-tasks-local | ✅ | Yes | — | "Get Paid Securely" claim | **Not used**: in-person local tasks are out of scope, and payments aren't live | — |
| 9 | fund-couple | (icon only) | — | **£7,200 of £10,000, 72%** | Milestone panel + button | Panel and figures cropped out | Home "Give help" |
| 10 | fund-mobile | (icon only) | — | **£7,200 of £10,000, 72%** | Panel + button | Panel and figures cropped out | Home "Business partnerships" |
| 11 | mobile-onboarding | ✅ | Yes (panel clear; phone tiny) | — | "Get Help / Offer a Service / Fund a Need / Join" buttons | Panel cropped out; phone ® removed | Sign-in/up panel; final call to action; OG card |
| 12 | community | ✅ | **Yes (clear)** on banner and hoodie | — | Logo band + 4 button tiles | Band and tiles cropped out; hoodie ® removed | /give; Get Started (help) |

How ® marks were removed: the final "d" of each wordmark was located automatically, the small region to its upper right was filled with the surrounding background colour (letter pixels excluded), and every result was checked at 4× zoom. Banner patches were visible on the gradient, so the banner was retired instead.

**Optimisation:** WebP at quality 78, max width 1600 px; total 1.0 MB (was 1.8 MB). `next/image` serves responsive AVIF/WebP sizes for mobile and desktop. File names are versioned (`-v2`) so no CDN or browser cache can serve the old artwork.

**Representation:** the set shows Black, white, South Asian, East Asian and Middle Eastern people, women in hijab, an older man and woman, and a wheelchair user (framing adjusted to keep the wheelchair visible). No single image is used more than twice across the site, and never twice on one page.

**Still recommended (designer):** regenerate artwork **without** ® and without baked-in UI at source, so future crops aren't needed. Do not reintroduce ® until the trade mark is registered.
