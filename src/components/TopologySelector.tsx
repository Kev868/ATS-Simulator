import React from 'react';
import { Topology } from '../engine/types';

interface Props {
  onSelect: (topology: Topology) => void;
  onCustom: () => void;
}

const cardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '2px solid #334155',
  borderRadius: '12px',
  padding: '32px',
  cursor: 'pointer',
  transition: 'border-color 0.2s, transform 0.1s',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  minWidth: '260px',
  maxWidth: '320px',
  flex: '1',
};

function TwoSourceSVG() {
  return (
    <svg viewBox="0 0 260 80" width="240" height="80">
      {/* M1 */}
      <circle cx="20" cy="40" r="14" fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x="20" y="44" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">M1</text>
      {/* cable */}
      <line x1="34" y1="40" x2="60" y2="40" stroke="#94a3b8" strokeWidth="2" />
      {/* breaker 52-M1 */}
      <rect x="60" y="32" width="16" height="16" fill="#22c55e" rx="2" />
      <text x="68" y="46" textAnchor="middle" fill="#0f172a" fontSize="8">M1</text>
      <line x1="76" y1="40" x2="90" y2="40" stroke="#94a3b8" strokeWidth="2" />
      {/* Bus */}
      <rect x="90" y="35" width="80" height="10" fill="#22c55e" rx="2" />
      <text x="130" y="28" textAnchor="middle" fill="#94a3b8" fontSize="9">BUS 1</text>
      {/* Load */}
      <line x1="130" y1="45" x2="130" y2="60" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M122,60 Q126,54 130,60 Q134,66 138,60" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <path d="M122,65 Q126,59 130,65 Q134,71 138,65" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      {/* cable */}
      <line x1="170" y1="40" x2="184" y2="40" stroke="#94a3b8" strokeWidth="2" />
      {/* breaker 52-M2 */}
      <rect x="184" y="32" width="16" height="16" fill="#475569" rx="2" />
      <text x="192" y="46" textAnchor="middle" fill="#94a3b8" fontSize="8">M2</text>
      <line x1="200" y1="40" x2="220" y2="40" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,2" />
      {/* M2 */}
      <circle cx="240" cy="40" r="14" fill="none" stroke="#3b82f6" strokeWidth="2" />
      <text x="240" y="44" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">M2</text>
    </svg>
  );
}

function MTMSvg() {
  return (
    <svg viewBox="0 0 320 90" width="300" height="90">
      {/* M1 */}
      <circle cx="20" cy="45" r="14" fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x="20" y="49" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">M1</text>
      <line x1="34" y1="45" x2="55" y2="45" stroke="#94a3b8" strokeWidth="2" />
      {/* 52-M1 */}
      <rect x="55" y="37" width="14" height="14" fill="#22c55e" rx="2" />
      <line x1="69" y1="45" x2="85" y2="45" stroke="#94a3b8" strokeWidth="2" />
      {/* Bus1 */}
      <rect x="85" y="40" width="60" height="10" fill="#22c55e" rx="2" />
      <text x="115" y="32" textAnchor="middle" fill="#94a3b8" fontSize="9">BUS 1</text>
      {/* Load1 */}
      <line x1="115" y1="50" x2="115" y2="65" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M108,65 Q112,59 116,65 Q120,71 124,65" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      {/* 52-T */}
      <line x1="145" y1="45" x2="160" y2="45" stroke="#94a3b8" strokeWidth="2" />
      <rect x="160" y="37" width="14" height="14" fill="#475569" rx="2" />
      <text x="167" y="49" textAnchor="middle" fill="#94a3b8" fontSize="8">T</text>
      <line x1="174" y1="45" x2="190" y2="45" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3,2" />
      {/* Bus2 */}
      <rect x="190" y="40" width="60" height="10" fill="#334155" rx="2" />
      <text x="220" y="32" textAnchor="middle" fill="#94a3b8" fontSize="9">BUS 2</text>
      {/* Load2 */}
      <line x1="220" y1="50" x2="220" y2="65" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M213,65 Q217,59 221,65 Q225,71 229,65" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      {/* 52-M2 */}
      <line x1="250" y1="45" x2="265" y2="45" stroke="#94a3b8" strokeWidth="2" />
      <rect x="265" y="37" width="14" height="14" fill="#475569" rx="2" />
      <line x1="279" y1="45" x2="300" y2="45" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3,2" />
      {/* M2 */}
      <circle cx="300" cy="45" r="14" fill="none" stroke="#3b82f6" strokeWidth="2" />
      <text x="300" y="49" textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">M2</text>
    </svg>
  );
}

function MMMSvg() {
  // Compact layout — fits viewBox 260×82 at width 240 without clipping
  return (
    <svg viewBox="0 0 260 82" width="240" height="76">
      {/* M1 */}
      <circle cx="12" cy="41" r="9" fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x="12" y="45" textAnchor="middle" fill="#22c55e" fontSize="8" fontWeight="bold">M1</text>
      <line x1="21" y1="41" x2="33" y2="41" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="33" y="36" width="10" height="10" fill="#22c55e" rx="1" />
      <line x1="43" y1="41" x2="55" y2="41" stroke="#94a3b8" strokeWidth="1.5" />
      {/* BUS1 */}
      <rect x="55" y="37" width="30" height="8" fill="#22c55e" rx="1" />
      <text x="70" y="30" textAnchor="middle" fill="#94a3b8" fontSize="7">BUS1</text>
      <line x1="70" y1="45" x2="70" y2="56" stroke="#94a3b8" strokeWidth="1" />
      <path d="M66,56 Q70,52 74,56 Q78,60 82,56" fill="none" stroke="#f59e0b" strokeWidth="1" />
      {/* T1 */}
      <line x1="85" y1="41" x2="95" y2="41" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="95" y="36" width="10" height="10" fill="#475569" rx="1" />
      <text x="100" y="44" textAnchor="middle" fill="#94a3b8" fontSize="6">T1</text>
      <line x1="105" y1="41" x2="115" y2="41" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* BUS2 */}
      <rect x="115" y="37" width="30" height="8" fill="#3b82f6" rx="1" />
      <text x="130" y="30" textAnchor="middle" fill="#94a3b8" fontSize="7">BUS2</text>
      <line x1="130" y1="45" x2="130" y2="56" stroke="#94a3b8" strokeWidth="1" />
      <path d="M126,56 Q130,52 134,56 Q138,60 142,56" fill="none" stroke="#f59e0b" strokeWidth="1" />
      {/* T2 */}
      <line x1="145" y1="41" x2="155" y2="41" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="155" y="36" width="10" height="10" fill="#475569" rx="1" />
      <text x="160" y="44" textAnchor="middle" fill="#94a3b8" fontSize="6">T2</text>
      <line x1="165" y1="41" x2="175" y2="41" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* BUS3 */}
      <rect x="175" y="37" width="30" height="8" fill="#334155" rx="1" />
      <text x="190" y="30" textAnchor="middle" fill="#94a3b8" fontSize="7">BUS3</text>
      <line x1="190" y1="45" x2="190" y2="56" stroke="#94a3b8" strokeWidth="1" />
      <path d="M186,56 Q190,52 194,56 Q198,60 202,56" fill="none" stroke="#f59e0b" strokeWidth="1" />
      {/* 52-M3 */}
      <line x1="205" y1="41" x2="215" y2="41" stroke="#94a3b8" strokeWidth="1.5" />
      <rect x="215" y="36" width="10" height="10" fill="#475569" rx="1" />
      <line x1="225" y1="41" x2="237" y2="41" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2" />
      {/* M3 */}
      <circle cx="248" cy="41" r="9" fill="none" stroke="#a855f7" strokeWidth="2" />
      <text x="248" y="45" textAnchor="middle" fill="#a855f7" fontSize="8" fontWeight="bold">M3</text>
    </svg>
  );
}

export default function TopologySelector({ onSelect, onCustom }: Props) {
  const [hovered, setHovered] = React.useState<Topology | null>(null);

  const getCardStyle = (topo: Topology): React.CSSProperties => ({
    ...cardStyle,
    borderColor: hovered === topo ? '#3b82f6' : '#334155',
    transform: hovered === topo ? 'translateY(-4px)' : 'none',
    boxShadow: hovered === topo ? '0 8px 24px rgba(59,130,246,0.3)' : 'none',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '40px',
      padding: '40px',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#e2e8f0', fontSize: '2rem', margin: 0, fontWeight: 700 }}>
          ATS Simulator
        </h1>
        <p style={{ color: '#64748b', marginTop: '8px', fontSize: '1rem' }}>
          Select a topology to begin
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Two Source */}
        <div
          style={getCardStyle('TWO_SOURCE')}
          onMouseEnter={() => setHovered('TWO_SOURCE')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelect('TWO_SOURCE')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onSelect('TWO_SOURCE')}
        >
          <TwoSourceSVG />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.1rem' }}>Two-Source ATS</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
              Simple dual-source automatic transfer.<br />
              One bus, two mains (M1/M2).
            </div>
          </div>
        </div>

        {/* MTM */}
        <div
          style={getCardStyle('MTM')}
          onMouseEnter={() => setHovered('MTM')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelect('MTM')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onSelect('MTM')}
        >
          <MTMSvg />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.1rem' }}>Main-Tie-Main</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
              Two buses with sectionalizing tie.<br />
              M1—Bus1—Tie—Bus2—M2
            </div>
          </div>
        </div>

        {/* MMM */}
        <div
          style={getCardStyle('MMM')}
          onMouseEnter={() => setHovered('MMM')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelect('MMM')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onSelect('MMM')}
        >
          <MMMSvg />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.1rem' }}>Main-Main-Main</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
              Three buses with two tie breakers.<br />
              M1—Bus1—T1—Bus2—T2—Bus3—M3
            </div>
          </div>
        </div>
        {/* Custom topology builder */}
        <div
          style={{
            ...cardStyle,
            borderColor: '#475569',
            borderStyle: 'dashed',
            opacity: 0.85,
          }}
          onClick={onCustom}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onCustom()}
        >
          {/* Simple grid icon */}
          <svg viewBox="0 0 240 80" width="220" height="80">
            {[40, 80, 120, 160, 200].map(x => (
              <line key={x} x1={x} y1={10} x2={x} y2={70} stroke="#334155" strokeWidth={1} />
            ))}
            {[20, 40, 60].map(y => (
              <line key={y} x1={20} y1={y} x2={220} y2={y} stroke="#334155" strokeWidth={1} />
            ))}
            <circle cx={40}  cy={40} r={6} fill="none" stroke="#22c55e" strokeWidth={2} />
            <line x1={46}    y1={40} x2={74}  y2={40} stroke="#475569" strokeWidth={1.5} />
            <rect  x={74}    y={34} width={12} height={12} fill="#334155" stroke="#94a3b8" strokeWidth={1.5} />
            <line x1={86}    y1={40} x2={120} y2={40} stroke="#475569" strokeWidth={1.5} />
            <line x1={120}   y1={20} x2={200} y2={20} stroke="#3b82f6" strokeWidth={3} strokeLinecap="square" />
            <line x1={120}   y1={60} x2={200} y2={60} stroke="#475569" strokeWidth={3} strokeLinecap="square" />
            <text x={120} y={50} fill="#475569" fontSize="9" fontFamily="monospace">BUS-A</text>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.1rem' }}>Build Custom Topology</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px' }}>
              Grid-based drag-and-drop editor.<br />
              Place sources, breakers, buses and wires.
            </div>
          </div>
        </div>
      </div>

      <p style={{ color: '#475569', fontSize: '0.8rem' }}>
        You can change the topology at any time by resetting the simulation.
      </p>
    </div>
  );
}
