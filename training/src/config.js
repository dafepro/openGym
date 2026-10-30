export const TRAINING_DEMO = __TRAINING_DEMO__

// These are application identities, not credentials or existing provisioned resources.
export const APP_CONFIG = Object.freeze({
  id: 'quicktrack-training',
  name: 'QuickTrack Training',
  origin: 'https://train.quicktrack.cc',
  build: __TRAINING_BUILD__,
  catalogPath: '/api/catalog',
  mediaPath: '/media/',
  storageDatabase: 'quicktrack-training',
  cachePrefix: 'quicktrack-training-',
  sourceUrl: `https://github.com/dafepro/openGym/tree/${/^[a-f0-9]{40}$/.test(__TRAINING_BUILD__) ? __TRAINING_BUILD__ : 'codex/quicktrack-training'}/training`,
  demo: TRAINING_DEMO
})
