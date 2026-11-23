# SolveANeed — Requester Safeguarding Design

People asking for help may be in financial difficulty, and that creates a power imbalance with supporters. These safeguards prevent supporters from exploiting requesters. Each one is marked:

✅ **Built and tested now** (Phase 2.5) · 🟦 **Designed — built with Phase 3 offers/messages** · ⬜ **Policy/operational**

## 1. Explicit opt-in to paid opportunities
- ✅ `support_preferences.open_to_paid_tasks` defaults to **false**. Requesters turn it on themselves in Matching Preferences.
- ✅ A need lists the support types it accepts; `paid_task` is never pre-selected (the default is Give only).
- 🟦 The offer RPC refuses a `paid_task` offer unless the requester has opted in **and** the need accepts paid tasks. Opting out later cancels pending (unaccepted) task offers.

## 2. Fair and transparent task terms
- 🟦 Every task offer must include price, deliverables, deadline, objective acceptance criteria, revision limit, cancellation policy and dispute window (AGREEMENT_ENGINE §2). Incomplete offers can't be sent.
- 🟦 A minimum effective rate: offers must state estimated hours, and price ÷ hours must meet a platform minimum that references the National Minimum Wage **[VERIFY with counsel]**.
- 🟦 Accepted terms are immutable (`agreements` trigger ✅ already enforced in the schema). Any change creates a new version both parties must accept.
- 🟦 Auto-acceptance when a supporter doesn't review within the dispute window, so silence can't be used to withhold payment.
- 🟦 Fees are shown before acceptance; requesters never pay to receive offers.

## 3. Prohibition of coercive or humiliating conditions
- ⬜ Acceptable Use Policy (draft ✅ published) prohibits coercion, sexual content or favours, illegal or deceptive work, and unreasonable personal demands.
- 🟦 Offer and milestone text is scanned on submission with the same detector as needs (✅ `detect_sensitive_content` exists), plus a prohibited-terms list (e.g. "video of you", "meet in person", "thank you post", "photo of your home"). Matches are held for moderator review before delivery.
- 🟦 Milestone criteria are moderated: they must be lawful, reasonable and objectively verifiable. Public thank-yous, testimonials, social-media posts or personal disclosures are never allowed as a condition.
- 🟦 Early tasks are limited to an allow-list of low-risk remote categories (design, writing, research, data entry, tutoring online). In-person tasks stay disabled.

## 4. No requirement to accept work to qualify for donations
- ✅ Gifts and tasks are separate types. `contributions` has no link to agreements, so a gift can never be made conditional in the data model.
- 🟦 The gift flow states "unconditional — the requester owes nothing". A supporter message that ties a gift to doing work ("I'll donate if you…") is flagged by the detector.
- ⬜ Ranking never favours requesters who accept paid work (matching ✅ does not score it).

## 5. Independent dispute escalation
- 🟦 Disputes are decided by a moderator with no involvement in the agreement or relationship to either party (the database already blocks moderators deciding their own needs and reports ✅; the same rule extends to agreements).
- 🟦 One appeal to a different moderator. Every decision includes written reasons, visible to both parties.
- ⬜ Published complaints and appeals procedure with timescales (Compliance Register #11).

## 6. Report and block supporters
- ✅ `block_user`, `unblock_user`, `my_blocked_users` RPCs; a "Blocked members" section in Settings; blocks are private to the blocker; rate-limited; audit-logged.
- ✅ `is_blocked_between()` is ready for offer, message and order RPCs (internal only).
- ✅ Reports on needs and profiles validate their target and are rate-limited. Moderators can suspend accounts (only admins can suspend staff ✅).
- 🟦 Block and Report buttons on every offer, message thread and agreement. Blocking cancels pending offers from that member.

## 7. Restrictions on requests for sensitive personal information
- ✅ `detect_sensitive_content()` flags bank details (sort code, account number, IBAN, card numbers), contact details (email, UK/Nigerian phone numbers, WhatsApp/Telegram etc.), and identity numbers (passport, National Insurance, BVN/NIN, passwords/PINs). Tested with positive and negative cases.
- ✅ Need submission records a `sensitive_content` risk signal for moderators.
- 🟦 Messages and offers: contact details and identity numbers are masked before delivery with an explanation ("For your safety, contact details are hidden until an agreement is in place"). Repeated attempts raise a moderator signal.
- ⬜ Supporters never see a requester's address. Supplier deliveries go directly via the supplier (AGREEMENT_ENGINE §4).

## 8. Protection against off-platform payment manipulation
- ✅ The detector flags "PayPal me", "bank transfer", "pay directly", gift cards and crypto in needs.
- 🟦 The same detection runs in messages and offers, with an inline warning to **both** parties: "Payments outside SolveANeed aren't protected. We will never ask you to pay a fee to receive help."
- 🟦 Any "fee to receive help" request is prohibited (a classic advance-fee scam) and leads to immediate suspension pending review.
- ⬜ Safety guidance page and onboarding checklist for requesters.

## 9. Additional protections
- ✅ 18+ attestation at sign-up (database-enforced); rate limits on account and marketplace actions; staff MFA.
- 🟦 Cooling-off: a requester can't accept a paid task within 1 hour of receiving it (no pressure tactics).
- 🟦 Supporter limits: a new supporter account (under 7 days, unverified) can't send more than N task offers per day.
- ⬜ Safeguarding lead role; escalation path for risk to life (signposting to emergency services and support charities).
