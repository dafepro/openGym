import { describe, it, expect } from 'vitest'
import { EMPTY_PLAYER_PROFILE, loadPlayerProfile, savePlayerProfile, validatePlayerProfile } from './player-profile.js'
const memory = () => { const entries = new Map(); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) } }
describe('local player profile', () => {
  it('starts blank, trims optional input and isolates databases', () => {
    const storage = memory()
    expect(loadPlayerProfile('family', storage)).toEqual({ profile: EMPTY_PLAYER_PROFILE, error: '' })
    const profile = savePlayerProfile('family', { nickname: ' Sam ', preferredFoot: 'Left', role: 'Midfielder', goals: 'Work on first touch' }, storage)
    expect(profile.nickname).toBe('Sam')
    expect(loadPlayerProfile('family', storage).profile).toEqual(profile)
    expect(loadPlayerProfile('demo', storage).profile).toEqual(EMPTY_PLAYER_PROFILE)
    expect(validatePlayerProfile(EMPTY_PLAYER_PROFILE)).toEqual(EMPTY_PLAYER_PROFILE)
  })
  it('handles corrupted or unsupported profiles without touching sessions', () => {
    const storage = memory()
    storage.setItem('family:player-profile-v1', '{broken')
    expect(loadPlayerProfile('family', storage).error).toContain('could not be read')
    storage.setItem('family:player-profile-v1', JSON.stringify({ version: 2, profile: EMPTY_PLAYER_PROFILE }))
    expect(loadPlayerProfile('family', storage).error).toContain('could not be read')
    expect(loadPlayerProfile('family', storage).profile).toEqual(EMPTY_PLAYER_PROFILE)
  })
  it('bounds input and exposes storage failures rather than claiming a save', () => {
    expect(() => validatePlayerProfile({ ...EMPTY_PLAYER_PROFILE, nickname: 'x'.repeat(41) })).toThrow()
    expect(() => validatePlayerProfile({ ...EMPTY_PLAYER_PROFILE, goals: 'x'.repeat(281) })).toThrow()
    expect(() => validatePlayerProfile({ ...EMPTY_PLAYER_PROFILE, preferredFoot: 'invented' })).toThrow()
    expect(() => savePlayerProfile('family', EMPTY_PLAYER_PROFILE, { setItem() { throw new Error('quota') } })).toThrow('could not be saved')
    expect(loadPlayerProfile('family', { getItem() { throw new Error('blocked') } }).error).toContain('could not be read')
  })
})
