import { useSyncExternalStore } from 'react'

export const ROUTES = Object.freeze({ today: '#/today', history: '#/history', practice: '#/practice', build: '#/build' })

export function routeFromHash(hash = '') {
  if (hash.startsWith('#/shared/')) return 'shared'
  return Object.keys(ROUTES).find(route => ROUTES[route] === hash) || 'today'
}

const subscribe = notify => {
  window.addEventListener('hashchange', notify)
  return () => window.removeEventListener('hashchange', notify)
}
const snapshot = () => routeFromHash(window.location.hash)

export function useHashRoute() {
  return useSyncExternalStore(subscribe, snapshot, () => 'today')
}

export function useSharedPracticeToken() {
  return useSyncExternalStore(subscribe, () => window.location.hash.startsWith('#/shared/') ? window.location.hash.slice('#/shared/'.length) : null, () => null)
}
