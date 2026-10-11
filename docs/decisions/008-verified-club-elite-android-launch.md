# 008 — Verified Club Elite Android launch

Accepted 2026-10-11. The owner authorizes installing the official Club Elite + app
on the existing MyChart_Phone emulator and testing browser-to-app check-in access.

Google Play's com.trainerize.clubfitness package (8.18.4, version code 1018400)
registers a BROWSABLE VIEW handler for the trainerize scheme. Its bundled client
routes include trainerize://widget.dash.open. A real Android Chrome link tap opens
the installed app, and its QR action displays a rotating check-in code after sign-in.

Use a fixed intent URI targeting that dashboard route and the exact Club Elite
package. Include the encoded official Play listing as browser_fallback_url. Keep
the link in the current tab so the explicit tap hands off directly. iOS, desktop
and custom HTTPS shortcuts retain their existing destinations. Arbitrary stored
intent or custom-scheme URLs remain rejected; no gym credentials or membership
codes enter Uplift storage.

Inspection of the installed app's deep-link and notification handlers did not
identify an external barcode-panel route. Do not invent one or describe dashboard
launch as opening the barcode. The owner can tap the QR action inside Club Elite.
The vendor may add routes later; a changed route needs fresh device verification.

Validation: official Play installation, signed-in app launch and dynamic-code panel,
real Chrome intent tap, Android card handoff checks, destination/fallback boundary
checks, existing check-in regressions and the production build. Package inspection
artifacts remain temporary and outside the source repository and public assets.
