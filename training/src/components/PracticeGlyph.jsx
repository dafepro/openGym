// Decorative category motif, not a diagram of the practice setup.
export default function PracticeGlyph({ movement = false, partner = false }) {
  return <span className={`qt-practice-glyph${movement ? ' is-movement' : ''}`} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><path className="qt-glyph-grid" d="M8 8h48v48H8zM32 8v48"/><path className="qt-glyph-route" d={partner ? 'M16 44 32 18 48 44Z' : movement ? 'M16 48 48 38 16 26 48 16' : 'M18 48C18 30 46 38 46 22S22 10 22 24'} /><circle cx={partner ? 16 : 18} cy={partner ? 44 : 48} r="4" fill="currentColor"/><path d="m28 13 4-7 4 7zM43 53l4-7 4 7z" fill="currentColor"/>{partner && <circle cx="48" cy="44" r="4" fill="currentColor"/>}</svg></span>
}
