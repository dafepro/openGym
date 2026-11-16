import { useEffect, useRef, useState } from 'react'

import { fieldCue } from '../domain/field-cues.js'

export default function FieldControls({ large, onLarge, phase, paused, seconds, countdown, identity, active }) {
  const [sound, setSound] = useState(false)
  const [audioStatus, setAudioStatus] = useState('Sound off')
  const [awake, setAwake] = useState(false)
  const [wakeStatus, setWakeStatus] = useState('Screen awake off')
  const audio = useRef(null)
  const previous = useRef(null)
  const tones = useRef(new Set())
  const stopTones = () => {
    for (const oscillator of tones.current) oscillator.stop()
    tones.current.clear()
  }
  const visible = () => document.visibilityState === 'visible'
  const play = (kind) => {
    const context = audio.current
    if (!context || context.state !== 'running' || !visible()) return
    const notes =
      kind === 'count' ? [660] : kind === 'work' ? [660, 880] : kind === 'rest' ? [440, 330] : [880, 880, 880]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(),
        gain = context.createGain()
      const start = context.currentTime + index * 0.19
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14)
      oscillator.connect(gain)
      gain.connect(context.destination)
      tones.current.add(oscillator)
      oscillator.start(start)
      oscillator.stop(start + 0.15)
      oscillator.onended = () => {
        tones.current.delete(oscillator)
        oscillator.disconnect()
        gain.disconnect()
      }
    })
  }
  const toggleSound = async () => {
    if (sound) {
      stopTones()
      if (audio.current) audio.current.onstatechange = null
      setSound(false)
      setAudioStatus('Sound off')
      return
    }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext
      if (!Audio) throw new Error('unsupported')
      const context = audio.current || new Audio()
      audio.current = context
      context.onstatechange = () => {
        if (context.state !== 'running') stopTones()
        setAudioStatus(context.state === 'running' ? 'Sound ready' : 'Sound suspended — turn off and on to retry')
      }
      await context.resume()
      if (audio.current !== context) return
      setSound(true)
      setAudioStatus(context.state === 'running' ? 'Sound ready' : 'Sound suspended — turn off and on to retry')
      play('work')
    } catch {
      setAudioStatus('Sound unavailable — try again')
    }
  }
  useEffect(
    () => () => {
      const context = audio.current
      audio.current = null
      if (context) {
        context.onstatechange = null
        context.close().catch(() => {})
      }
    },
    []
  )
  useEffect(() => {
    const reset = () => {
      stopTones()
      previous.current = null
    }
    document.addEventListener('visibilitychange', reset)
    return () => document.removeEventListener('visibilitychange', reset)
  }, [])
  useEffect(() => {
    const current = { phase, paused, seconds: Math.ceil(seconds), countdown, identity, visible: visible() }
    const cue = fieldCue(previous.current, current)
    if (sound && active && cue) play(cue)
    previous.current = current
  }, [sound, active, phase, paused, seconds, countdown, identity])
  useEffect(() => {
    let disposed = false,
      lock = null,
      pending = false
    const release = () => {
      const held = lock
      lock = null
      held?.release().catch(() => {})
    }
    const request = async () => {
      if (disposed || pending || lock || !visible() || !awake || !active) return
      if (!navigator.wakeLock?.request) {
        setWakeStatus('Screen awake unsupported')
        return
      }
      pending = true
      try {
        const held = await navigator.wakeLock.request('screen')
        if (disposed || !visible()) {
          await held.release()
          return
        }
        lock = held
        setWakeStatus('Screen kept awake')
        held.addEventListener('release', () => {
          if (lock === held) {
            lock = null
            if (!disposed) setWakeStatus('Screen awake released — turn off and on to retry')
          }
        })
      } catch {
        if (!disposed) setWakeStatus('Screen awake unavailable — turn off and on to retry')
      } finally {
        pending = false
      }
    }
    const visibility = () => {
      if (visible()) request()
      else {
        release()
        if (!disposed && awake) setWakeStatus('Screen awake paused while hidden')
      }
    }
    setWakeStatus(awake && active ? 'Requesting screen awake…' : 'Screen awake off')
    request()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      release()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [awake, active])
  return (
    <details className="pb-field-settings">
      <summary>Field settings{large ? ' · large display' : ''}</summary>
      <div className="pb-field-options">
        <button type="button" aria-pressed={large} onClick={() => onLarge(!large)}>
          Large display
        </button>
        <button type="button" aria-pressed={sound} onClick={toggleSound}>
          Audible cues
        </button>
        <button type="button" aria-pressed={awake} disabled={!active} onClick={() => setAwake(!awake)}>
          Keep screen awake
        </button>
      </div>
      <p role="status">
        {audioStatus} · {wakeStatus}
      </p>
      <p>
        Sound on plays a test cue. Rising tones: work. Falling tones: rest. Three beeps: timer ended; return to check
        and record. Final 3 seconds tick. Check your volume before stepping away. Cues need this page visible.
      </p>
    </details>
  )
}
