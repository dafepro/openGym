import { useSyncExternalStore } from 'react'
import { transitionView } from './motion.js'

export const ROUTES = Object.freeze({ today: '#/today', me: '#/me', history: '#/me', practice: '#/practice', build: '#/build' })

export function routeFromHash(hash = '') {
  if (hash === '#/history') return 'me'
  if (hash.startsWith('#/shared/')) return 'shared'
  return Object.keys(ROUTES).find(route => ROUTES[route] === hash) || 'today'
}

const subscribe = notify => {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}
const routeSubscribe = notify => {
  const order = { today: 0, me: 1, history: 1, build: 1, shared: 2, practice: 3 }
  let previous = routeFromHash(window.location.hash)
  const change = () => { const next = routeFromHash(window.location.hash); const direction = order[next] < order[previous] ? 'back' : 'forward'; previous = next; transitionView(notify, direction) }
  window.addEventListener('hashchange', change)
  return () => window.removeEventListener('hashchange', change)
}
const snapshot = () => routeFromHash(window.location.hash)

export function useHashRoute() {
  return useSyncExternalStore(routeSubscribe, snapshot, () => 'today')
}

export function useSharedPracticeToken() {
  return useSyncExternalStore(subscribe, () => window.location.hash.startsWith('#/shared/') ? window.location.hash.slice('#/shared/'.length) : null, () => null)
}
