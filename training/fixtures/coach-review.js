// Synthetic test data only; never part of the production catalog.
export const reviewJob = {
  id: '12345678-1234-4234-8234-123456789abc',
  owner: 'a'.repeat(64),
  headSha: 'd'.repeat(40),
  prNumber: 123,
  prUrl: 'https://github.com/dafepro/openGym/pull/123',
  status: 'submitted',
  createdAt: 1794860000000,
  recipients: [],
  recipientCount: 0,
  plan: {
    title: 'Synthetic close control',
    goal: 'Keep touches close.',
    overview: 'Synthetic software test, no athletic work.',
    drills: [
      {
        title: 'Synthetic cone touches',
        setup: 'One ball and two cones.',
        instructions: 'Move between the cones.',
        focus: 'Small touches.',
        mode: 'time',
        sets: 2,
        reps: null,
        durationSec: 60,
        restSec: 30,
        side: 'each',
        tags: ['futbol:ball-control'],
        demonstrationUrl: 'https://www.youtube.com/watch?v=QKz7fDjPnvg',
        sources: [{ title: 'Synthetic video reference', url: 'https://www.youtube.com/watch?v=QKz7fDjPnvg' }]
      }
    ]
  },
  videos: [
    {
      videoId: 'QKz7fDjPnvg',
      url: 'https://www.youtube.com/watch?v=QKz7fDjPnvg',
      title: 'Synthetic video reference',
      author: 'Synthetic coach'
    }
  ]
}
