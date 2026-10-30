import { useSyncExternalStore } from 'react'

export const ROUTES = Object.freeze({ today: '#/today', history: '#/history', practice: '#/practice' })

export function routeFromHash(hash = '') {
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
