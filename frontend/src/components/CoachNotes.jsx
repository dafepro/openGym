import React, { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { readCoachNotes, writeCoachNotes } from '../lib/coach.js'
import { Button } from './ui.jsx'

function Editor({ initial, onSave, close }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="chat-menu">
      <h3>
        {t('Coach')} · {t('Notes')}
      </h3>
      <textarea
        autoFocus
        aria-label={t('Notes')}
        className="input"
        rows={5}
        maxLength={600}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="btnrow">
        <Button onClick={close}>{t('Cancel')}</Button>
        <Button
          variant="primary"
          onClick={() => {
            useStore.getState().update((s) => writeCoachNotes(s, value))
            onSave?.(value)
            close()
          }}
        >
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}
export function CoachNotes({ value, onSave }) {
  const open = () =>
    useUI
      .getState()
      .openSheet((close) => (
        <Editor initial={value ?? readCoachNotes(useStore.getState().S)} onSave={onSave} close={close} />
      ))
  return (
    <Button size="sm" variant="tinted" onClick={open}>
      {t('Notes')}
    </Button>
  )
}
