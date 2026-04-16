// ─── Main Menu — Civilization VI inspired layout ──────────────────────────────
// Left panel: vertical list of menu items.  Right panel: fade-on-hover preview.
// Settings and About render as modal overlays.

import React, { useState, useCallback, useEffect } from 'react';
import { Topology } from '../engine/types';
import { GraphTopology } from '../engine/graphTopology';
import { parseTopologyJSON } from '../engine/topoSchema';
import AnimatedBackground from './AnimatedBackground';

// ─── Preview SVGs (inline, no external dependencies) ─────────────────────────

function TwoSourceSvg() {
  return (
    <svg viewBox="0 0 200 60" width="200" height="60">
      <circle cx="16" cy="30" r="11" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      <path d="M8,30 C11,24 21,36 24,30" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      <line x1="27" y1="30" x2="44" y2="30" stroke="#475569" strokeWidth="1.5" />
      <rect x="44" y="22" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="46" y1="24" x2="58" y2="36" stroke="#94a3b8" strokeWidth="1" />
      <line x1="60" y1="30" x2="80" y2="30" stroke="#475569" strokeWidth="1.5" />
      <line x1="80" y1="22" x2="80" y2="38" stroke="#3b82f6" strokeWidth="4" strokeLinecap="square" />
      <line x1="80" y1="30" x2="100" y2="30" stroke="#475569" strokeWidth="1.5" />
      <rect x="100" y="22" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="102" y1="24" x2="114" y2="36" stroke="#94a3b8" strokeWidth="1" />
      <line x1="116" y1="30" x2="133" y2="30" stroke="#475569" strokeWidth="1.5" />
      <circle cx="149" cy="30" r="11" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      <path d="M141,30 C144,24 154,36 157,30" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Load drop */}
      <line x1="80" y1="38" x2="80" y2="48" stroke="#475569" strokeWidth="1.5" />
      <rect x="65" y="48" width="30" height="10" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
      <text x="80" y="56" textAnchor="middle" fill="#f59e0b" fontSize="5" fontFamily="monospace">LOAD</text>
    </svg>
  );
}

function MTMSvg() {
  return (
    <svg viewBox="0 0 240 70" width="240" height="70">
      {/* M1 */}
      <circle cx="16" cy="30" r="11" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      <path d="M8,30 C11,24 21,36 24,30" fill="none" stroke="#22c55e" strokeWidth="1.5" />
      {/* 52-M1 */}
      <line x1="27" y1="30" x2="42" y2="30" stroke="#475569" strokeWidth="1.5" />
      <rect x="42" y="22" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="44" y1="24" x2="56" y2="36" stroke="#94a3b8" strokeWidth="1" />
      {/* BUS-A */}
      <line x1="58" y1="30" x2="78" y2="30" stroke="#475569" strokeWidth="1.5" />
      <line x1="78" y1="22" x2="78" y2="38" stroke="#22c55e" strokeWidth="4" strokeLinecap="square" />
      {/* 52-T */}
      <line x1="78" y1="30" x2="96" y2="30" stroke="#475569" strokeWidth="1.5" />
      <rect x="96" y="22" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="98" y1="24" x2="110" y2="36" stroke="#94a3b8" strokeWidth="1" />
      {/* BUS-B */}
      <line x1="112" y1="30" x2="130" y2="30" stroke="#475569" strokeWidth="1.5" />
      <line x1="130" y1="22" x2="130" y2="38" stroke="#3b82f6" strokeWidth="4" strokeLinecap="square" />
      {/* 52-M2 */}
      <line x1="130" y1="30" x2="148" y2="30" stroke="#475569" strokeWidth="1.5" />
      <rect x="148" y="22" width="16" height="16" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
      <line x1="150" y1="24" x2="162" y2="36" stroke="#94a3b8" strokeWidth="1" />
      {/* M2 */}
      <line x1="164" y1="30" x2="179" y2="30" stroke="#475569" strokeWidth="1.5" />
      <circle cx="195" cy="30" r="11" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      <path d="M187,30 C190,24 200,36 203,30" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Loads */}
      <line x1="78" y1="38" x2="78" y2="50" stroke="#475569" strokeWidth="1.5" />
      <rect x="64" y="50" width="28" height="9" fill="none" stroke="#f59e0b" strokeWidth="1" />
      <line x1="130" y1="38" x2="130" y2="50" stroke="#475569" strokeWidth="1.5" />
      <rect x="116" y="50" width="28" height="9" fill="none" stroke="#f59e0b" strokeWidth="1" />
    </svg>
  );
}

function MMMSvg() {
  return (
    <svg viewBox="0 0 260 82" width="240" height="76">
      <circle cx="12"  cy="41" r="9" fill="none" stroke="#22c55e" strokeWidth="1.5"/>
      <path d="M5,41 C7.5,36 16.5,46 19,41" fill="none" stroke="#22c55e" strokeWidth="1.4"/>
      <line x1="21"  y1="41" x2="34"  y2="41" stroke="#475569" strokeWidth="1.5"/>
      <rect x="34"   y="34" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="1.4"/>
      <line x1="36"  y1="36" x2="45"  y2="45" stroke="#94a3b8" strokeWidth="1"/>
      <line x1="47"  y1="41" x2="62"  y2="41" stroke="#475569" strokeWidth="1.5"/>
      <line x1="62"  y1="33" x2="62"  y2="49" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="square"/>
      <line x1="62"  y1="41" x2="77"  y2="41" stroke="#475569" strokeWidth="1.5"/>
      <rect x="77"   y="34" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="1.4"/>
      <line x1="79"  y1="36" x2="88"  y2="45" stroke="#94a3b8" strokeWidth="1"/>
      <line x1="90"  y1="41" x2="109" y2="41" stroke="#475569" strokeWidth="1.5"/>
      <line x1="109" y1="33" x2="109" y2="49" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="square"/>
      <circle cx="109" cy="20" r="9" fill="none" stroke="#64748b" strokeWidth="1.4"/>
      <path d="M102,20 C104.5,15 113.5,25 116,20" fill="none" stroke="#64748b" strokeWidth="1.2"/>
      <line x1="109" y1="29" x2="109" y2="33" stroke="#475569" strokeWidth="1.5"/>
      <line x1="109" y1="41" x2="124" y2="41" stroke="#475569" strokeWidth="1.5"/>
      <rect x="124" y="34" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="1.4"/>
      <line x1="126" y1="36" x2="135" y2="45" stroke="#94a3b8" strokeWidth="1"/>
      <line x1="137" y1="41" x2="156" y2="41" stroke="#475569" strokeWidth="1.5"/>
      <line x1="156" y1="33" x2="156" y2="49" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="square"/>
      <line x1="156" y1="41" x2="171" y2="41" stroke="#475569" strokeWidth="1.5"/>
      <rect x="171" y="34" width="13" height="13" fill="none" stroke="#94a3b8" strokeWidth="1.4"/>
      <line x1="173" y1="36" x2="182" y2="45" stroke="#94a3b8" strokeWidth="1"/>
      <line x1="184" y1="41" x2="239" y2="41" stroke="#475569" strokeWidth="1.5"/>
      <circle cx="248" cy="41" r="9" fill="none" stroke="#a855f7" strokeWidth="1.5"/>
      <path d="M241,41 C243.5,36 252.5,46 255,41" fill="none" stroke="#a855f7" strokeWidth="1.4"/>
      <line x1="62"  y1="49" x2="62"  y2="62" stroke="#475569" strokeWidth="1.5"/>
      <rect x="50"  y="62" width="24" height="8" fill="none" stroke="#f59e0b" strokeWidth="1"/>
      <line x1="156" y1="49" x2="156" y2="62" stroke="#475569" strokeWidth="1.5"/>
      <rect x="144" y="62" width="24" height="8" fill="none" stroke="#f59e0b" strokeWidth="1"/>
    </svg>
  );
}

// ─── Menu item data ───────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  label: string;
  description: string;
  preview?: React.ReactNode;
  action: 'preset-two-source' | 'preset-mtm' | 'preset-mmm' | 'custom' | 'load' | 'settings' | 'about';
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: 'two-source',
    label: 'Two-Source ATS',
    description: 'Single bus fed from a preferred utility and an alternate source. Classic open-transition transfer switch.',
    preview: <TwoSourceSvg />,
    action: 'preset-two-source',
  },
  {
    id: 'mtm',
    label: 'Main-Tie-Main',
    description: 'Two buses linked by a normally-open tie breaker. Supports closed-transition paralleling and selective load shedding.',
    preview: <MTMSvg />,
    action: 'preset-mtm',
  },
  {
    id: 'mmm',
    label: 'Main-Main-Main',
    description: 'Three buses with two tie breakers. Suitable for facilities with three independent utility feeds.',
    preview: <MMMSvg />,
    action: 'preset-mmm',
  },
  {
    id: 'custom',
    label: 'Build Custom Topology',
    description: 'Open the drag-and-drop topology builder. Place components, draw wires, assign roles, then simulate.',
    action: 'custom',
  },
  {
    id: 'load',
    label: 'Load Saved Topology',
    description: 'Import a previously saved topology JSON file and continue editing or simulate it.',
    action: 'load',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Adjust simulation defaults and display preferences.',
    action: 'settings',
  },
  {
    id: 'about',
    label: 'About',
    description: 'Version info, acknowledgements, and project links.',
    action: 'about',
  },
];

// ─── Modal overlays ───────────────────────────────────────────────────────────

function ModalOverlay({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500,
    }} onClick={onClose}>
      <div style={{
        background: '#111827', border: '1px solid #1e3a5f',
        borderRadius: 10, padding: '32px 36px', maxWidth: 480, width: '90%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.15rem', marginBottom: 20 }}>{title}</div>
        {children}
        <button onClick={onClose} style={{
          marginTop: 24, background: '#1e3a5f', color: '#94a3b8',
          border: '1px solid #2d4f70', borderRadius: 5, padding: '7px 18px',
          cursor: 'pointer', fontSize: '0.82rem',
        }}>Close</button>
      </div>
    </div>
  );
}

function SettingsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay title="Settings" onClose={onClose}>
      <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.7 }}>
        <p style={{ margin: '0 0 10px' }}>Simulation settings are configured per-topology in the simulator panel.</p>
        <p style={{ margin: 0, color: '#334155' }}>Additional global preferences will appear here in a future release.</p>
      </div>
    </ModalOverlay>
  );
}

function AboutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay title="About ATS Simulator" onClose={onClose}>
      <div style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.8 }}>
        <p style={{ margin: '0 0 8px' }}>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>ATS Simulator</span> — IEEE/ANSI 315 one-line diagram engine
          with graph-based connectivity sweep.
        </p>
        <p style={{ margin: '0 0 8px' }}>Presets: Two-Source ATS · Main-Tie-Main · Main-Main-Main</p>
        <p style={{ margin: '0 0 8px' }}>Custom topology builder with drag, rotate, wire, undo/redo.</p>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.78rem' }}>
          Built with React 18 · TypeScript · Vite · Vitest
        </p>
      </div>
    </ModalOverlay>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onSelect: (t: Topology) => void;
  onCustom: () => void;
  onLoadFile: (topo: GraphTopology) => void;
}

export default function TopologyMenu({ onSelect, onCustom, onLoadFile }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visiblePreviewId, setVisiblePreviewId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<'settings' | 'about' | null>(null);
  const [loadErrors, setLoadErrors] = useState<string[] | null>(null);

  // Fade-swap: when hover changes, briefly fade out then show new preview
  const fadeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHover = useCallback((id: string | null) => {
    setHoveredId(id);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (id === null) {
      setVisiblePreviewId(null);
    } else {
      fadeTimer.current = setTimeout(() => setVisiblePreviewId(id), 60);
    }
  }, []);

  const openFilePicker = useCallback(() => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = ev => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      file.text()
        .then(text => {
          const result = parseTopologyJSON(text);
          if (!result.ok) {
            setLoadErrors(result.errors);
          } else {
            onLoadFile(result.topo);
          }
        })
        .catch(() => setLoadErrors(['Could not read the file — please try again']));
    };
    inp.click();
  }, [onLoadFile]);

  const handleAction = useCallback((item: MenuItem) => {
    switch (item.action) {
      case 'preset-two-source': onSelect('TWO_SOURCE'); break;
      case 'preset-mtm':        onSelect('MTM');        break;
      case 'preset-mmm':        onSelect('MMM');        break;
      case 'custom':            onCustom();             break;
      case 'load':              openFilePicker();        break;
      case 'settings': setOverlay('settings'); break;
      case 'about':    setOverlay('about');    break;
    }
  }, [onSelect, onCustom, openFilePicker]);

  const activeItem = MENU_ITEMS.find(i => i.id === visiblePreviewId);

  return (
    <div style={{
      position: 'relative', width: '100vw', height: '100vh',
      display: 'flex', overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <AnimatedBackground />

      {/* ── Left: menu list ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '40%', minWidth: 280, maxWidth: 420,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        paddingLeft: 64, paddingBottom: 40,
      }}>
        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            color: '#f1f5f9', fontWeight: 700, fontSize: '2rem',
            letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            ATS Simulator
          </div>
          <div style={{ color: '#334155', fontSize: '0.8rem', marginTop: 6, letterSpacing: '0.12em' }}>
            AUTOMATIC TRANSFER SWITCH
          </div>
        </div>

        {/* Menu items */}
        <nav>
          {MENU_ITEMS.map(item => {
            const isHovered = hoveredId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => handleHover(item.id)}
                onMouseLeave={() => handleHover(null)}
                onClick={() => handleAction(item)}
                style={{
                  position: 'relative',
                  paddingLeft: 16,
                  paddingTop: 10, paddingBottom: 10,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${isHovered ? '#3b82f6' : 'transparent'}`,
                  background: isHovered ? 'rgba(59,130,246,0.06)' : 'transparent',
                  transition: 'border-color 150ms, background 150ms, color 150ms',
                  marginBottom: 2,
                }}
              >
                <div style={{
                  color: isHovered ? '#f1f5f9' : '#94a3b8',
                  fontWeight: isHovered ? 400 : 300,
                  fontSize: '1.1rem',
                  letterSpacing: '0.04em',
                  transition: 'color 150ms, font-weight 150ms',
                }}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* ── Right: preview pane ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{
          opacity: visiblePreviewId ? 1 : 0,
          transition: 'opacity 150ms ease',
          textAlign: 'center',
          maxWidth: 380,
        }}>
          {activeItem && (
            <>
              {activeItem.preview && (
                <div style={{ marginBottom: 24, opacity: 0.85 }}>
                  {activeItem.preview}
                </div>
              )}
              <div style={{
                color: '#f1f5f9', fontWeight: 600, fontSize: '1.1rem', marginBottom: 10,
              }}>
                {activeItem.label}
              </div>
              <div style={{
                color: '#64748b', fontSize: '0.88rem', lineHeight: 1.65,
              }}>
                {activeItem.description}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Overlays ── */}
      {overlay === 'settings' && <SettingsOverlay onClose={() => setOverlay(null)} />}
      {overlay === 'about'    && <AboutOverlay    onClose={() => setOverlay(null)} />}

      {/* ── Load error overlay ── */}
      {loadErrors && (
        <ModalOverlay title="Could Not Load Topology" onClose={() => setLoadErrors(null)}>
          <div style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 12 }}>
            The file failed schema validation. Errors found:
          </div>
          <ul style={{ color: '#fca5a5', fontSize: '0.78rem', paddingLeft: 16, margin: '0 0 8px', lineHeight: 1.8, maxHeight: 240, overflowY: 'auto' }}>
            {loadErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <button
            onClick={() => { setLoadErrors(null); openFilePicker(); }}
            style={{
              marginTop: 8, background: '#1d4ed8', color: '#dbeafe',
              border: '1px solid #2563eb', borderRadius: 5,
              padding: '7px 18px', cursor: 'pointer', fontSize: '0.82rem', marginRight: 8,
            }}
          >
            Try Again
          </button>
        </ModalOverlay>
      )}
    </div>
  );
}
