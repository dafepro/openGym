const paths = {
  volume: <><path d="m11 4-6 5H2v6h3l6 5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  muted: <><path d="m11 4-6 5H2v6h3l6 5Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  history: <><path d="M4 5v5h5M4.8 9a8 8 0 1 1-.3 6" /><path d="M12 8v5l3 2" /></>,
  forward: <path d="M4 12h16m-7-7 7 7-7 7" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  back: <path d="m15 5-7 7 7 7" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  flag: <><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="m12 8 4 3-1.5 4h-5L8 11Zm0-5v5M3.5 9 8 11m1.5 4-3 4m8-4 3 4M16 11l4.5-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  video: <><rect x="3" y="5" width="14" height="14" rx="3" /><path d="m17 10 4-3v10l-4-3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  warning: <><path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v5m0 3v.1" /></>,
  replay: <><path d="M4 9V4m0 5h5M4.8 8a8 8 0 1 1-.3 7" /></>,
  expand: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  undo: <><path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
}

export default function Icon({ name, size = 22, className = '', ...props }) {
  return <svg className={'qt-icon ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name] || paths.info}</svg>
}
