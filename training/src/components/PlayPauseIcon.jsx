export default function PlayPauseIcon({ playing }) {
  return <svg className={`qt-play-pause${playing ? ' is-playing' : ''}`} viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path className="qt-play-shape" d="M7 4 L21 12 L7 20 Z" /><g className="qt-pause-shape"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></g></svg>
}
