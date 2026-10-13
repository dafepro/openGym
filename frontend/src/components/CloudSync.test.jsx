// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import CloudSyncSection, { DriveSetupSheet, cloudConnectionView } from './CloudSync.jsx'
import { useCloudSync } from '../store/useCloudSync.js'
import { useUI } from '../store/useUI.js'
import { loadGoogleIdentity } from '../lib/google-drive.js'
vi.mock('../lib/google-drive.js', () => ({ loadGoogleIdentity: vi.fn(async () => {}), validClientId: id => /^\d+-\w+\.apps\.googleusercontent\.com$/.test(id || ''), authorizeDrive: vi.fn(), googleDriveProvider: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container, root
beforeEach(() => {
  localStorage.clear(); useCloudSync.setState({ clientId: '', connection: null, status: 'off', lastSynced: 0, error: null })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); localStorage.clear() })
const render = async element => act(async () => root.render(element))
const tap = async text => act(async () => [...container.querySelectorAll('button,[role="button"]')].find(b => b.textContent.includes(text))?.click())
it('offers Drive setup without loading Google before it is configured', async () => {
  loadGoogleIdentity.mockClear()
  await render(<CloudSyncSection />)
  expect(container.textContent).toContain('Set up Google Drive')
  expect(container.textContent).toContain('Photos and videos stay local')
  expect(loadGoogleIdentity).not.toHaveBeenCalled()
})
it('labels the client ID input and disables invalid save values', async () => {
  await render(<DriveSetupSheet close={() => {}} />)
  const field = container.querySelector('input')
  expect(container.querySelector('label').htmlFor).toBe(field.id)
  expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Save').disabled).toBe(true)
  expect(container.querySelector('a').rel).toContain('noopener')
})
it('shows an expired connection as reconnect, without a misleading Sync now action', async () => {
  useCloudSync.setState({ clientId: '123-test.apps.googleusercontent.com', connection: { account: { id: 'a', label: 'Test account' }, owner: '' }, status: 'auth' })
  await render(<CloudSyncSection />)
  expect(container.textContent).toContain('Reconnect Google Drive')
  expect(container.textContent).not.toContain('Sync now')
})
it('disconnect requires confirmation and says local and Drive copies are retained', async () => {
  useCloudSync.setState({ connection: { account: { id: 'a', label: 'Test account' }, owner: '' }, status: 'ok' })
  const open = vi.spyOn(useUI.getState(), 'openSheet')
  await render(<CloudSyncSection />); await tap('Disconnect')
  const sheet = open.mock.calls[0][0](() => {})
  expect(sheet.props.title).toBe('Disconnect Google Drive?')
  expect(sheet.props.message).toContain('copy in Drive are kept')
  expect(useCloudSync.getState().connection).not.toBeNull()
})
it('sends cloud error indicators to Drive settings and clears them on success', () => {
  const connection = { account: { id: 'a' }, owner: '' }
  expect(cloudConnectionView({ connection, status: 'offline' })).toMatchObject({ action: 'drive', tone: 'off' })
  expect(cloudConnectionView({ connection, status: 'ok' })).toBeNull()
})
