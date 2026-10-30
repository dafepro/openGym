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
  sourceUrl: 'https://github.com/dafepro/openGym',
  demo: TRAINING_DEMO
})
