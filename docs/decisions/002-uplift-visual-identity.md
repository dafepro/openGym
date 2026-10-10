# 002 — Uplift visual identity and openGym attribution

Accepted 2026-10-10. Supersedes the rebranding deferral in ADR 001. Live deployment is still deferred.

Use the original Uplift public icon and local Barlow Condensed 600 font (SIL Open Font License),
charcoal `#101214`, slate `#1a1d20` / `#252a2d`, pale lime `#d0f878`, muted `#a6b1b5`,
rest blue `#8bd0fa`, warm-up lavender `#cab4fc` and completion mint `#a9ebca`.
Carry the shared 150/220 ms motion curve `cubic-bezier(.22,1,.36,1)` through presses and
anchored disclosure transitions. Preserve the explicitly requested amber active workout button,
blue rest progress ring and finite halo handoff. Timer ticks update progress without replaying
entry motion. Pause stops the decorative ring pulse; reduced motion removes animation entirely.

Adapt these tokens to the fork’s components rather than changing workout semantics or fixed
thumb positions. Dark is the default for new profiles; existing Light, System and custom accent
preferences remain valid. Light colors are darker versions for readable text and buttons.
The display font is preloaded locally and required in the transactional service-worker shell,
so an offline reopen includes the visual identity and failed installs preserve the old build.

Visible app name, PWA/native install names/icons, onboarding, About, notifications and shared
outputs say Uplift. “Powered by openGym” links to the upstream in onboarding and About and
appears in exported workout cards and printed plans. Keep AGPL, copyright notices and the
verbatim exercise-media attribution unchanged. Rebranding does not expand the exercise-media
license; review that separate permission before distributing a renamed public release.

The translation boundary brands inherited prose before interpolating caller-owned data. Paths,
URLs, namespaces, backup entry names, database/cache names and history-state keys retain their
existing identifiers, including `Documents/openGym`, `opengym_plan`, the Drive snapshot graph
and Garmin v1 protocol. Existing data and the original Uplift app are not renamed or migrated.
Native package identity remains compatible with existing installs. User-export filenames may
say Uplift; format markers and inner ZIP entries remain compatible.

Source/update links belong to `dafepro/openGym`. Android release checks use that fork’s GitHub
assets and require the selected APK’s matching SHA-256 file before installing. Do not install an
upstream binary over Uplift. This pass neither publishes an APK nor signs a new native release.

Visual source references: original Uplift `docs/PRODUCT_INTENT.md`, ADRs 008, 016 and 029,
`src/ui/visual-system.css`, `motion.css`, `ContextControls.css`, `RestRing.css`, and `public/icon.svg`.
Only public identity assets and the font/license were copied; no private workout data or photos.
