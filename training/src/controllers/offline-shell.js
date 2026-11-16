export async function prepareOfflineShell(serviceWorker) {
  const registration = await serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  if (registration.active) return
  const worker = registration.installing || registration.waiting
  if (!worker) throw new Error('Offline installation did not start')
  await new Promise((resolve, reject) => {
    const changed = () => {
      if (worker.state === 'activated' || worker.state === 'installed') {
        worker.removeEventListener('statechange', changed)
        resolve()
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', changed)
        reject(new Error('Offline installation failed'))
      }
    }
    worker.addEventListener('statechange', changed)
    changed()
  })
}
