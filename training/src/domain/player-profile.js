export const EMPTY_PLAYER_PROFILE = Object.freeze({ nickname: '', preferredFoot: '', role: '', goals: '' })
export const PLAYER_FEET = Object.freeze(['Left', 'Right', 'Both'])
export const PLAYER_ROLES = Object.freeze(['Goalkeeper', 'Defender', 'Midfielder', 'Forward', 'Still exploring'])
const keyFor = databaseName => `${databaseName}:player-profile-v1`

export function validatePlayerProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Player details are not valid.')
  const profile = {}
  for (const [field, limit] of Object.entries({ nickname: 40, preferredFoot: 10, role: 30, goals: 280 })) {
    if (typeof value[field] !== 'string' || value[field].length > limit || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value[field])) throw new Error('Player details contain unsupported text.')
    profile[field] = value[field].trim()
  }
  if (profile.preferredFoot && !PLAYER_FEET.includes(profile.preferredFoot) || profile.role && !PLAYER_ROLES.includes(profile.role)) throw new Error('Choose a listed foot and playing role.')
  return profile
}

export function loadPlayerProfile(databaseName, storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(keyFor(databaseName))
    if (!raw) return { profile: { ...EMPTY_PLAYER_PROFILE }, error: '' }
    const saved = JSON.parse(raw)
    if (saved.version !== 1) throw new Error('Unsupported player profile version.')
    return { profile: validatePlayerProfile(saved.profile), error: '' }
  } catch {
    return { profile: { ...EMPTY_PLAYER_PROFILE }, error: 'Saved player details could not be read. You can enter them again; session history is separate.' }
  }
}

export function savePlayerProfile(databaseName, value, storage) {
  const profile = validatePlayerProfile(value)
  try {
    const target = storage ?? globalThis.localStorage
    if (!target) throw new Error('Storage unavailable')
    target.setItem(keyFor(databaseName), JSON.stringify({ version: 1, profile }))
  } catch {
    throw new Error('Player details could not be saved on this device. Your edits are still here; try saving again.')
  }
  return profile
}
