# 004 — Companion mark and original Uplift wordmark

Accepted 2026-10-10. Refines the icon and wordmark in ADR 002.

The fork homepage used an uppercase Barlow Condensed heading, while original Uplift's header
uses lowercase sans-serif `uplift /`. Match the original header's font stack, weight 650,
letter spacing -1.1px, 23px desktop / 21px phone sizing and lime slash. Keep condensed display
type for workout headings and prominent numbers. Onboarding/login use the same lowercase
identity at a larger size; accessible app naming remains Uplift.

Reuse the exact U-and-up-arrow path from original Uplift's `scripts/build-garmin.mjs`, which
generates `garmin/resources/launcher.png`. This is the owner's companion mark, not Garmin's
corporate logo. The original source is already vector artwork; no bitmap enlargement, tracing,
AI generation or external assets are needed. Adapt its colors to charcoal #101214 and lime
#d0f878 and use a rounded-square background for web/install/native icons. Keep all glyph strokes
inside the central safe area for maskable icons. Regenerate raster assets from the SVG.

This change updates the fork. Original Uplift remains the reference checkout. Keep homepage
calendar, session shortcuts and statistics behavior, existing attribution and all storage,
backup and sync identifiers unchanged. No history migration or live deployment is involved.

Validation: compare the rendered home headers at phone and desktop widths, inspect the mark
at icon and install sizes, and run relevant existing identity/home tests and production builds.
