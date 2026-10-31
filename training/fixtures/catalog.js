// Synthetic software-test data only. These values are not training recommendations.
export const syntheticCatalog = {
  schemaVersion: 1,
  synthetic: true,
  revision: 'synthetic-catalog-v1',
  currentAssignmentId: 'synthetic-current',
  currentAssignmentRevision: 'synthetic-assignment-v1',
  assignments: [
    {
      id: 'synthetic-current', revision: 'synthetic-assignment-v1', title: 'Synthetic practice — software demo',
      assignedOn: '2026-10-30', status: 'current',
      drills: [
        { id: 'synthetic-reps', title: 'Synthetic repetition example', instructions: 'Software test fixture. Demonstrates recording repetitions; no exercise technique is prescribed.', mode: 'reps', sets: 2, reps: 4, side: 'both', restSec: 10, media: { id: 'sample-playback', status: 'approved', path: '/media/sample-playback' } },
        { id: 'synthetic-time', title: 'Synthetic timed example', instructions: 'Software test fixture. Demonstrates a short work timer, interruption review and rest.', mode: 'time', sets: 1, durationSec: 5, side: 'both', restSec: 10, media: { id: 'sample-playback', status: 'approved', path: '/media/sample-playback' } },
        { id: 'synthetic-sides', title: 'Synthetic each-side example', instructions: 'Software test fixture. Left and right are separate records; these counts are not advice.', mode: 'reps', sets: 1, reps: 3, side: 'each', restSec: 0, media: { id: 'synthetic-unavailable', status: 'unavailable' } },
        { id: 'synthetic-watch', title: 'Synthetic watch-only example', instructions: 'Software test fixture. Reviewing this item records no athletic repetitions or duration.', mode: 'watch', sets: 1, side: 'both', restSec: null, media: { id: 'sample-playback', status: 'approved', path: '/media/sample-playback' } },
      ],
    },
    {
      id: 'synthetic-prior', revision: 'synthetic-prior-v1', title: 'Synthetic previous assignment',
      assignedOn: '2026-10-23', status: 'archived',
      drills: [
        { id: 'synthetic-prior-watch', title: 'Synthetic archived review', instructions: 'Software test fixture. This archived assignment remains readable and repeatable as a new attempt.', mode: 'watch', sets: 1, side: 'both', restSec: null, media: { id: 'synthetic-unavailable', status: 'unavailable' } },
      ],
    },
  ],
}
