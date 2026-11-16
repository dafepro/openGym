export default function PracticeSketch() {
  return (
    <svg className="pb-practice-sketch" viewBox="0 0 260 135" aria-hidden="true">
      <path
        className="pb-ball-path"
        d="M26 102C75 110 54 32 117 41S159 127 231 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="5 7"
      />
      <path d="m218 31 15-3-2 15" fill="none" stroke="currentColor" strokeWidth="2" />
      {[
        [70, 72],
        [138, 22],
        [205, 95]
      ].map(([x, y]) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <ellipse cx="0" cy="18" rx="17" ry="4" fill="#d8ddc3" />
          <path d="M-11 17-3-12h6l8 29Z" fill="#a74725" />
          <path d="m-7 4 14 0" stroke="#fffaf0" strokeWidth="4" />
        </g>
      ))}
      <g transform="translate(29 100)">
        <circle r="13" fill="#fffaf0" stroke="currentColor" />
        <path d="m0-7 7 5-3 8h-8l-3-8Z" fill="currentColor" />
      </g>
    </svg>
  )
}
