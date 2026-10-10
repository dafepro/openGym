import { useLayoutEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import WorkoutTimerRing from './WorkoutTimerRing.jsx'
import './WorkoutButtonFace.css'

const colors = { ready: 'var(--acc)', active: 'var(--orange)', rest: 'var(--blue)' }

// Only a phase change hands the color over. Timer ticks, Pause and route changes keep
// the same face and progress ring; no animation callback owns workout state.
export default function WorkoutButtonFace({ state }) {
  const face = useRef(null), previous = useRef(state)
  useLayoutEffect(() => {
    const from = previous.current
    previous.current = state
    const node = face.current
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (from === state || preference?.matches || !node?.animate) return
    const surface = node.querySelector('.wbf-surface')
    const options = { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }
    const animations = [
      node.querySelector('.wbf-base').animate([{ backgroundColor: colors[from] }, { backgroundColor: colors[from] }], options),
      node.querySelector('.wbf-bloom').animate([{ clipPath: 'circle(0% at 50% 50%)', opacity: 1 }, { clipPath: 'circle(74% at 50% 50%)', opacity: 1 }], options),
      surface.animate([{ transform: 'scale(1)' }, { transform: 'scale(.94)', offset: .25 }, { transform: 'scale(1.04)', offset: .7 }, { transform: 'scale(1)' }], { ...options, duration: 540 }),
    ]
    if (from !== 'ready') animations.push(node.querySelector('.wbf-halo').animate([
      { backgroundColor: colors[from], transform: 'scale(1.16)', opacity: .4 },
      { backgroundColor: colors[from], transform: 'scale(.92)', opacity: 0 },
    ], { duration: 280, easing: 'ease-out' }))
    const cancel = () => animations.forEach(animation => animation.cancel())
    const reduce = () => { if (preference.matches) cancel() }
    preference?.addEventListener?.('change', reduce)
    return () => { preference?.removeEventListener?.('change', reduce); cancel() }
  }, [state])

  return <span className="cir" ref={face} data-state={state}>
    <span className="wbf-halo" aria-hidden="true" />
    <span className="wbf-surface" aria-hidden="true"><span className="wbf-base" /><span className="wbf-bloom" /></span>
    <Icon name="play" />
    {state === 'rest' && <WorkoutTimerRing />}
  </span>
}
