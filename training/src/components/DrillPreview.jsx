import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import CoachingBrief from './CoachingBrief.jsx'
import DrillDemonstration from './DrillDemonstration.jsx'
import Dialog from './Dialog.jsx'
import Icon from './Icon.jsx'
import { prescriptionLabel } from './ui.jsx'

// Browsing a drill starts with its instructions. Video is always an explicit action.
export default function DrillPreview({ drill, sample, onPlaybackError }) {
  const [showVideo, setShowVideo] = useState(false)
  const player = useRef(null)
  return <div className="qt-drill-preview">
    <div className="qt-work-target"><strong>{prescriptionLabel(drill)}</strong>{drill.restSec != null && <span>{drill.restSec}s rest</span>}</div>
    <CoachingBrief drill={drill} />
    {drill.media?.status === 'approved' ? <button className="qt-demo-trigger" type="button" aria-haspopup="dialog" aria-expanded={showVideo} onClick={() => { flushSync(() => setShowVideo(true)); player.current?.play()?.catch(() => {}) }}>
      <span className="qt-demo-thumb" aria-hidden="true">{drill.media.poster ? <img src={drill.media.poster} alt=""/> : <Icon name="ball" size={30}/>}<span><Icon name="play" size={18}/></span></span><span>Watch demonstration<small>Tap to play · starts muted</small></span><Icon name="arrow" size={18}/>
    </button> : <p className="qt-instructions-only">Written instructions · no demonstration video</p>}
    {showVideo && <Dialog title={drill.title} className="qt-video-dialog" onClose={() => setShowVideo(false)}><DrillDemonstration playerRef={player} media={drill.media} title={drill.title} sample={sample} autoPlay onPlaybackError={onPlaybackError}/></Dialog>}
  </div>
}
