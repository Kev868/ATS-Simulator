// ─── Animated circuit-board background ───────────────────────────────────────
// SVG <pattern> tiles a PCB-style trace design across the full viewport.
// A slow 90-second translate3d pan plays on GPU; prefers-reduced-motion pauses it.
// A radial vignette overlay darkens edges toward the screen center.

import React, { useEffect } from 'react';

const CSS_ID = 'ats-bg-keyframes';

const KEYFRAME_CSS = `
@keyframes ats-circuit-pan {
  0%   { transform: translate3d(0px,    0px,    0) }
  25%  { transform: translate3d(-200px, -150px, 0) }
  50%  { transform: translate3d(-400px, -300px, 0) }
  75%  { transform: translate3d(-200px, -150px, 0) }
  100% { transform: translate3d(0px,    0px,    0) }
}
@media (prefers-reduced-motion: reduce) {
  .ats-circuit-pan { animation-play-state: paused !important; }
}
`;

export default function AnimatedBackground() {
  // Inject keyframe CSS once
  useEffect(() => {
    if (!document.getElementById(CSS_ID)) {
      const style = document.createElement('style');
      style.id = CSS_ID;
      style.textContent = KEYFRAME_CSS;
      document.head.appendChild(style);
    }
    return () => { /* leave style tag — cheaper than re-injecting */ };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* ── Tiled PCB pattern, slow-panning ── */}
      <div
        className="ats-circuit-pan"
        style={{
          position: 'absolute',
          // Oversized so panning never shows edge
          top: -600, left: -600,
          width: 'calc(100vw + 1200px)',
          height: 'calc(100vh + 1200px)',
          animation: 'ats-circuit-pan 90s linear infinite',
          willChange: 'transform',
        }}
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block' }}
        >
          <defs>
            {/* 120×120 repeating PCB cell */}
            <pattern id="pcb-cell" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              {/* Background fill */}
              <rect width="120" height="120" fill="#09111e" />

              {/* Horizontal traces */}
              <line x1="0"   y1="20"  x2="40"  y2="20"  stroke="#112035" strokeWidth="1.5" />
              <line x1="80"  y1="20"  x2="120" y2="20"  stroke="#112035" strokeWidth="1.5" />
              <line x1="0"   y1="60"  x2="30"  y2="60"  stroke="#0e1d32" strokeWidth="1" />
              <line x1="90"  y1="60"  x2="120" y2="60"  stroke="#0e1d32" strokeWidth="1" />
              <line x1="0"   y1="100" x2="50"  y2="100" stroke="#112035" strokeWidth="1.5" />
              <line x1="70"  y1="100" x2="120" y2="100" stroke="#112035" strokeWidth="1.5" />

              {/* Vertical traces */}
              <line x1="20"  y1="0"   x2="20"  y2="40"  stroke="#112035" strokeWidth="1.5" />
              <line x1="20"  y1="80"  x2="20"  y2="120" stroke="#112035" strokeWidth="1.5" />
              <line x1="60"  y1="0"   x2="60"  y2="35"  stroke="#0e1d32" strokeWidth="1" />
              <line x1="60"  y1="85"  x2="60"  y2="120" stroke="#0e1d32" strokeWidth="1" />
              <line x1="100" y1="0"   x2="100" y2="50"  stroke="#112035" strokeWidth="1.5" />
              <line x1="100" y1="70"  x2="100" y2="120" stroke="#112035" strokeWidth="1.5" />

              {/* Vias (filled circles at junctions) */}
              <circle cx="20"  cy="20"  r="3.5" fill="#0a1525" stroke="#152840" strokeWidth="1" />
              <circle cx="100" cy="20"  r="3.5" fill="#0a1525" stroke="#152840" strokeWidth="1" />
              <circle cx="20"  cy="100" r="3.5" fill="#0a1525" stroke="#152840" strokeWidth="1" />
              <circle cx="100" cy="100" r="3.5" fill="#0a1525" stroke="#152840" strokeWidth="1" />
              <circle cx="60"  cy="60"  r="4"   fill="#0c1830" stroke="#1a3050" strokeWidth="1.2" />

              {/* Small IC pad (rectangle) at center */}
              <rect x="45" y="45" width="30" height="30" rx="3"
                fill="#0b1628" stroke="#152840" strokeWidth="1" />
              {/* IC pin stubs */}
              <line x1="45" y1="52" x2="38" y2="52" stroke="#112035" strokeWidth="1" />
              <line x1="45" y1="60" x2="38" y2="60" stroke="#112035" strokeWidth="1" />
              <line x1="45" y1="68" x2="38" y2="68" stroke="#112035" strokeWidth="1" />
              <line x1="75" y1="52" x2="82" y2="52" stroke="#112035" strokeWidth="1" />
              <line x1="75" y1="60" x2="82" y2="60" stroke="#112035" strokeWidth="1" />
              <line x1="75" y1="68" x2="82" y2="68" stroke="#112035" strokeWidth="1" />

              {/* Diagonal trace accent */}
              <line x1="0" y1="0" x2="15" y2="15" stroke="#0d1e33" strokeWidth="1" />
              <line x1="105" y1="105" x2="120" y2="120" stroke="#0d1e33" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pcb-cell)" />
        </svg>
      </div>

      {/* ── Blur layer (CSS blur on the pattern div above) ── */}
      <div style={{
        position: 'absolute', inset: 0,
        backdropFilter: 'blur(0px)', // pattern is already subtle; skip blur to keep perf
        // To add blur: change above to 'blur(18px)' and wrap pattern div in a separate element
      }} />

      {/* ── Vignette overlay ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 40%, transparent 10%, rgba(9,14,27,0.88) 75%)',
      }} />

      {/* ── Solid dark base tint so text stays readable ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(9,14,27,0.55)',
      }} />
    </div>
  );
}
