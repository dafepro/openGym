import { useEffect, useRef, useState } from 'react'
import { tiltForce } from '../domain/ball-game.js'

const angle = () => window.screen.orientation?.angle ?? window.orientation ?? 0

export default function useBallTilt() {
  const [status, setStatus] = useState('off')
  const [listening, setListening] = useState(false)
  const request = useRef(0)
  const neutral = useRef(null)
  const latest = useRef(null)
  const force = useRef({ x: 0, y: 0, at: 0 })
  const disable = () => {
    request.current++
    force.current = { x: 0, y: 0, at: 0 }
    setListening(false)
    setStatus('off')
  }
  const enable = async () => {
    const id = ++request.current
    const Sensor = window.DeviceOrientationEvent
    if (!window.isSecureContext || !Sensor) {
      setStatus('unavailable')
      return
    }
    setStatus('requesting')
    try {
      const result = typeof Sensor.requestPermission === 'function' ? await Sensor.requestPermission() : 'granted'
      if (id !== request.current) return
      if (result !== 'granted') {
        setStatus('denied')
        return
      }
      neutral.current = null
      latest.current = null
      force.current = { x: 0, y: 0, at: 0 }
      setStatus('waiting')
      setListening(true)
    } catch {
      if (id === request.current) setStatus('unavailable')
    }
  }
  const calibrate = () => {
    neutral.current = latest.current ? { ...latest.current, angle: angle() } : null
    force.current = { x: 0, y: 0, at: performance.now() }
  }
  useEffect(() => {
    if (!listening) return
    const onOrientation = (event) => {
      if (![event.beta, event.gamma].every(Number.isFinite)) return
      const screenAngle = angle()
      latest.current = { beta: event.beta, gamma: event.gamma }
      if (!neutral.current || neutral.current.angle !== screenAngle) {
        neutral.current = { ...latest.current, angle: screenAngle }
        force.current = { x: 0, y: 0, at: performance.now() }
      }
      const next = tiltForce(event.beta, event.gamma, neutral.current, screenAngle)
      const smooth = (previous, value) => {
        const filtered = previous * 0.7 + value * 0.3
        return Math.abs(filtered) < 2 ? 0 : filtered
      }
      force.current = {
        x: smooth(force.current.x, next.x),
        y: smooth(force.current.y, next.y),
        at: performance.now()
      }
      setStatus('active')
    }
    window.addEventListener('deviceorientation', onOrientation)
    const timeout = window.setTimeout(() => {
      if (!latest.current) {
        setListening(false)
        setStatus('unavailable')
      }
    }, 3000)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.clearTimeout(timeout)
    }
  }, [listening])
  useEffect(
    () => () => {
      request.current++
    },
    []
  )
  return {
    status,
    enable,
    disable,
    calibrate,
    read: (now) => (now - force.current.at < 500 ? force.current : { x: 0, y: 0 })
  }
}
