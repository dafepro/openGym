# 007 — Steady check-in carousel

Accepted 2026-10-11. The owner requests stable vertical placement while swiping between
saved QR codes, dynamic gym-app shortcuts and the add-card slide.

Reserve the page subtitle's space when its message is hidden on an app card. Give all saved
cards the same header, body and reorder rows. Clamp long visible labels to two lines while
preserving their full text for accessibility, title and editing. The rail stretches every slide,
including the add-card slide, to the same height. Long membership values may grow the shared
rail, but they do not move controls when the active card changes.

Calculate the horizontal slide pitch from actual card offsets, including spacing. Remembering
the selected card during scrolling must not reset scrollLeft or interrupt browser scroll-snap.
External selection changes and card reordering still navigate to the remembered card.

The owner also requests opening Club Elite's barcode via Android intent. Chrome requires an
app-supported BROWSABLE handler, not just an installed package name. Its package is
com.trainerize.clubfitness, but no published barcode deep link has been verified in the official
Club Fitness/Trainerize pages or public web utilities. Keep the existing official shortcut until
the installed Android app's intent filters and barcode route can be inspected. Do not fabricate
a route, claim successful app launch from desktop tests or capture the dynamic code as a static card.

Validation: mixed-card phone-width visual measurements, manual horizontal swipes, and regression
checks for mid-swipe persistence and actual slide spacing. The test-only visual harness uses
synthetic memberships, is removed before committing, and is not shipped in production assets.
