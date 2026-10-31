import { Button, countLabel, formatClock } from './ui.jsx'
import Icon from './Icon.jsx'
import { practiceSummary } from '../domain/drill-selection.js'

// A sibling of the animated main content: fixed positioning never changes its containing block.
export default function SelectionTray({ visible, drills, onReview }) {
  const summary = practiceSummary(drills)
  return (
    <div
      className="qt-selection-tray"
      data-visible={visible}
      inert={!visible ? true : undefined}
      aria-hidden={!visible}
    >
      <div>
        <span>
          <strong key={drills.length}>{countLabel(drills.length, 'drill')} selected</strong>
          <small>
            {summary.allTimed
              ? `${formatClock(summary.timedSeconds)} of work`
              : summary.videoCount
              ? `${summary.videoCount} with video`
              : 'Ready to arrange'}
          </small>
        </span>
        <Button onClick={onReview}>
          Review <Icon name="forward" size={18} />
        </Button>
      </div>
    </div>
  )
}
