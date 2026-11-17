# Imported-unit regression coverage

This matrix distinguishes import-time normalization from repairing historical data.
It is not a guarantee that every source/version is supported, and does not authorize
rewriting existing records. Fixtures are synthetic; no personal export is required.

| Category | Storage contract | Regression evidence (`frontend/src/lib/`) |
| --- | --- | --- |
| Workout loads / StrongLifts bodyweight | kg/lb in profile unit, recorded loads rather than new prescriptions | `import-stronglifts.test.js`: distinct sessions/per-record conversion, independent daily bodyweight, no borrowed routine-scoped recommendations |
| Hevy workout loads and bodyweight | Explicit source kg converted to profile unit | `import-hevy.test.js`: lb profile and hundredth-precision cases |
| Hevy routine targets and cardio | Targets in profile unit; speed km/h, duration minutes, reps/counts unchanged | `import-hevy.test.js`: routine-load conversion with identical cardio in kg/lb profiles |
| Body CSV measurements | Built-in lengths cm; custom masses kg and lengths cm independently of display unit | `measurements-csv.test.js`: mixed inch/lb/cm values in both profiles; percent, blood pressure, pulse and unitless zero unchanged |
| Apple Health exported activities | Distance km, duration minutes, retained import source | `activities.test.js`: m/mi/km distance plus seconds duration, identical result in kg/lb profiles, reimport deduplication |
| Live health reads | Health weight normalized into profile units, provenance retained | `health-read.test.js` and `health-body.test.js` |
| Watch inputs | Exercise display-unit weights mapped back to profile storage | `watch-sync.ex-unit.test.js` |
| Whole-state unit changes | Weight-bearing state converted; canonical nonmass fields separate | `units.test.js` |
| Backup restoration | Backup state carries its own units, with explicit active-session handling | `../store/useStore.import-check.test.jsx` and `../store/useStore.import-restore.test.jsx` |

## Repair boundaries

- Do not multiply all imported numbers by a kg/lb factor. Cardio speed is km/h,
  activities are km/min, carries are metres and timed sets are seconds.
- Measurement history has no retained import batch/source metadata. Custom
  measurement `unit` controls display; its stored value is canonical cm/kg.
- CSV workout row source units are discarded after normalization. Activity
  `src: 'import'` and routine `hevyId` establish origin, not wrong units or whether
  a person subsequently edited a record.
- Health body-composition data is a separate read-only device cache, not an
  editable imported measurement log. Preserve health provenance to prevent export loops.
- Existing routine recommendations can have evolved since import. Never infer
  that all current targets or shared recommended weights need historical repair.
- Original-file reconciliation should compare individual matched fields, preview
  proposed changes, exclude ambiguous matches and protect later edits with a
  snapshot guard. Ordinary reimport intentionally skips existing data; it is not repair.

These tests verify parser/model behavior, not a rendered Settings repair flow,
real source-account integration, or the correctness of a particular user's history.
