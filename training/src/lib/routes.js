import { useSyncExternalStore } from 'react'
import { transitionView } from './motion.js'

export const ROUTES = Object.freeze({ today: '#/today', me: '#/me', history: '#/me', practice: '#/practice', build: '#/build', ball: '#/ball' })

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
  const order = { today: 0, build: 1, ball: 2, me: 3, history: 3, shared: 3, practice: 4 }
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
