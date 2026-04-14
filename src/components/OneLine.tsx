import React from 'react';
import { SimState, Breaker, Bus } from '../engine/types';

interface Props {
  state: SimState;
  onBreakerClick?: (breakerId: string) => void;
}

// Colors
const COLOR_ENERGIZED_M1 = '#22c55e';
const COLOR_ENERGIZED_M2 = '#3b82f6';
const COLOR_ENERGIZED_M3 = '#a855f7';
const COLOR_DEAD = '#334155';
const COLOR_BREAKER_CLOSED = '#22c55e';
const COLOR_BREAKER_OPEN = '#64748b';
const COLOR_BREAKER_OPERATING = '#f59e0b';
const COLOR_SOURCE_M1 = '#22c55e';
const COLOR_SOURCE_M2 = '#3b82f6';
const COLOR_SOURCE_M3 = '#a855f7';
const COLOR_LOAD = '#f59e0b';

function getBusColor(bus: Bus): string {
  if (!bus.energized) return COLOR_DEAD;
  if (bus.sourceId === 'M1') return COLOR_ENERGIZED_M1;
  if (bus.sourceId === 'M2') return COLOR_ENERGIZED_M2;
  if (bus.sourceId === 'M3') return COLOR_ENERGIZED_M3;
  return COLOR_ENERGIZED_M1;
}

function getSourceColor(id: string): string {
  if (id === 'M1') return COLOR_SOURCE_M1;
  if (id === 'M2') return COLOR_SOURCE_M2;
  if (id === 'M3') return COLOR_SOURCE_M3;
  return '#94a3b8';
}

interface BreakerSymbolProps {
  x: number;
  y: number;
  breaker: Breaker;
  onClick?: () => void;
  label?: string;
}

function BreakerSymbol({ x, y, breaker, onClick, label }: BreakerSymbolProps) {
  const isAnimating = breaker.state === 'CLOSING' || breaker.state === 'TRIPPING';
  const isClosed = breaker.state === 'CLOSED';

  let fill = COLOR_BREAKER_OPEN;
  if (isClosed) fill = COLOR_BREAKER_CLOSED;
  if (isAnimating) fill = COLOR_BREAKER_OPERATING;

  const size = 14;

  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
    >
      <rect
        x={x - size / 2}
        y={y - size / 2}
        width={size}
        height={size}
        fill={fill}
        stroke={isAnimating ? '#fbbf24' : '#1e293b'}
        strokeWidth="1.5"
        rx="2"
        opacity={isAnimating ? undefined : 1}
      >
        {isAnimating && (
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="0.6s"
            repeatCount="indefinite"
          />
        )}
      </rect>
      {/* Open indicator — diagonal line */}
      {!isClosed && !isAnimating && (
        <line
          x1={x - size / 2 + 3}
          y1={y - size / 2 + 3}
          x2={x + size / 2 - 3}
          y2={y + size / 2 - 3}
          stroke="#e2e8f0"
          strokeWidth="1.5"
        />
      )}
      {label && (
        <text
          x={x}
          y={y + size / 2 + 12}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="9"
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
      {/* State label */}
      <text
        x={x}
        y={y - size / 2 - 4}
        textAnchor="middle"
        fill={fill}
        fontSize="8"
        fontFamily="monospace"
      >
        {breaker.state}
      </text>
    </g>
  );
}

interface LoadSymbolProps {
  x: number;
  y: number;
  loadKW: number;
  energized: boolean;
}

function LoadSymbol({ x, y, loadKW, energized }: LoadSymbolProps) {
  const color = energized ? COLOR_LOAD : '#475569';
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 18} stroke={color} strokeWidth="1.5" />
      {/* Zigzag resistor */}
      <polyline
        points={`${x - 8},${y + 18} ${x - 4},${y + 24} ${x},${y + 18} ${x + 4},${y + 30} ${x + 8},${y + 24} ${x + 12},${y + 30} ${x + 16},${y + 24}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        transform={`translate(-4,0)`}
      />
      <text
        x={x}
        y={y + 48}
        textAnchor="middle"
        fill={color}
        fontSize="9"
        fontFamily="sans-serif"
      >
        {loadKW} kW
      </text>
    </g>
  );
}

interface BusLineProps {
  x: number;
  y: number;
  width: number;
  bus: Bus;
  label: string;
  fillTransition?: string;
}

function BusLine({ x, y, width, bus, label, fillTransition = 'fill 0.08s ease' }: BusLineProps) {
  const color = getBusColor(bus);
  const isDead = !bus.energized;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={10}
        fill={color}
        opacity={isDead ? 0.3 : 1}
        rx="2"
        strokeDasharray={isDead ? '6,4' : undefined}
        stroke={isDead ? '#475569' : undefined}
        style={{ transition: fillTransition }}
      />
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize="10"
        fontWeight="600"
        fontFamily="sans-serif"
      >
        {label}
      </text>
      {bus.energized && (
        <text
          x={x + width / 2}
          y={y + 22}
          textAnchor="middle"
          fill={color}
          fontSize="9"
          fontFamily="monospace"
        >
          {bus.voltage.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

// Progress arc for timers
interface TimerArcProps {
  cx: number;
  cy: number;
  r: number;
  progress: number; // 0-1
  label: string;
}

function TimerArc({ cx, cy, r, progress, label }: TimerArcProps) {
  const angle = progress * 360;
  const rad = (angle - 90) * (Math.PI / 180);
  const x2 = cx + r * Math.cos(rad);
  const y2 = cy + r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth="3" />
      {progress > 0 && (
        <path
          d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#f59e0b" fontSize="7" fontFamily="sans-serif">
        {label}
      </text>
    </g>
  );
}

// ─── TWO_SOURCE Layout ───────────────────────────────────────────────────────

function TwoSourceLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const fillTransition = speed <= 0.25 ? 'fill 0.4s ease' : 'fill 0.08s ease';
  const m1 = sources.find(s => s.id === 'M1')!;
  const m2 = sources.find(s => s.id === 'M2')!;
  const br_m1 = breakers.find(b => b.id === '52-M1')!;
  const br_m2 = breakers.find(b => b.id === '52-M2')!;
  const bus1 = buses.find(b => b.id === 'BUS1')!;

  const xferTimer = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retranTimer = activeTimers.find(t => t.id === 'RETRANSFER');

  return (
    <svg viewBox="0 0 560 160" width="100%" style={{ maxHeight: 200 }}>
      {/* M1 source */}
      <circle cx="50" cy="80" r="24" fill="none" stroke={getSourceColor('M1')} strokeWidth="2.5" />
      <text x="50" y="76" textAnchor="middle" fill={getSourceColor('M1')} fontSize="12" fontWeight="bold">M1</text>
      <text x="50" y="90" textAnchor="middle" fill={getSourceColor('M1')} fontSize="9">{m1.voltage.toFixed(0)}%</text>

      {/* Line M1 to breaker */}
      <line x1="74" y1="80" x2="110" y2="80" stroke="#475569" strokeWidth="2" />

      {/* Breaker 52-M1 */}
      <BreakerSymbol
        x={124}
        y={80}
        breaker={br_m1}
        onClick={() => onBreakerClick?.('52-M1')}
        label="52-M1"
      />
      <line x1="138" y1="80" x2="170" y2="80" stroke="#475569" strokeWidth="2" />

      {/* Bus 1 */}
      <BusLine x={170} y={75} width={220} bus={bus1} label="BUS 1" fillTransition={fillTransition} />

      {/* Load */}
      <LoadSymbol x={280} y={85} loadKW={bus1.loadKW} energized={bus1.energized} />

      {/* Transfer timer arc */}
      {xferTimer && !xferTimer.complete && (
        <TimerArc
          cx={280}
          cy={55}
          r={14}
          progress={xferTimer.elapsedMs / xferTimer.durationMs}
          label="XFR"
        />
      )}
      {retranTimer && !retranTimer.complete && (
        <TimerArc
          cx={310}
          cy={55}
          r={14}
          progress={retranTimer.elapsedMs / retranTimer.durationMs}
          label="RTR"
        />
      )}

      {/* Line Bus to 52-M2 */}
      <line x1="390" y1="80" x2="422" y2="80" stroke="#475569" strokeWidth="2" />

      {/* Breaker 52-M2 */}
      <BreakerSymbol
        x={436}
        y={80}
        breaker={br_m2}
        onClick={() => onBreakerClick?.('52-M2')}
        label="52-M2"
      />
      <line x1="450" y1="80" x2="486" y2="80" stroke="#475569" strokeWidth="2" />

      {/* M2 source */}
      <circle cx="510" cy="80" r="24" fill="none" stroke={getSourceColor('M2')} strokeWidth="2.5" />
      <text x="510" y="76" textAnchor="middle" fill={getSourceColor('M2')} fontSize="12" fontWeight="bold">M2</text>
      <text x="510" y="90" textAnchor="middle" fill={getSourceColor('M2')} fontSize="9">{m2.voltage.toFixed(0)}%</text>
    </svg>
  );
}

// ─── MTM Layout ──────────────────────────────────────────────────────────────

function MTMLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const fillTransition = speed <= 0.25 ? 'fill 0.4s ease' : 'fill 0.08s ease';
  const m1 = sources.find(s => s.id === 'M1')!;
  const m2 = sources.find(s => s.id === 'M2')!;
  const br_m1 = breakers.find(b => b.id === '52-M1')!;
  const br_t = breakers.find(b => b.id === '52-T')!;
  const br_m2 = breakers.find(b => b.id === '52-M2')!;
  const bus1 = buses.find(b => b.id === 'BUS1')!;
  const bus2 = buses.find(b => b.id === 'BUS2')!;

  const xferTimer = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retranTimer = activeTimers.find(t => t.id === 'RETRANSFER');
  const parallelTimer = activeTimers.find(t => t.id === 'PARALLEL_TIMER');

  return (
    <svg viewBox="0 0 700 180" width="100%" style={{ maxHeight: 220 }}>
      {/* M1 */}
      <circle cx="50" cy="90" r="24" fill="none" stroke={getSourceColor('M1')} strokeWidth="2.5" />
      <text x="50" y="86" textAnchor="middle" fill={getSourceColor('M1')} fontSize="12" fontWeight="bold">M1</text>
      <text x="50" y="100" textAnchor="middle" fill={getSourceColor('M1')} fontSize="9">{m1.voltage.toFixed(0)}%</text>

      <line x1="74" y1="90" x2="110" y2="90" stroke="#475569" strokeWidth="2" />

      <BreakerSymbol x={124} y={90} breaker={br_m1} onClick={() => onBreakerClick?.('52-M1')} label="52-M1" />
      <line x1="138" y1="90" x2="165" y2="90" stroke="#475569" strokeWidth="2" />

      {/* Bus 1 */}
      <BusLine x={165} y={85} width={160} bus={bus1} label="BUS 1" fillTransition={fillTransition} />

      {/* Load 1 */}
      <LoadSymbol x={245} y={95} loadKW={bus1.loadKW} energized={bus1.energized} />

      {/* Transfer timers */}
      {xferTimer && !xferTimer.complete && (
        <TimerArc cx={245} cy={60} r={14} progress={xferTimer.elapsedMs / xferTimer.durationMs} label="XFR" />
      )}
      {parallelTimer && !parallelTimer.complete && (
        <TimerArc cx={350} cy={55} r={16} progress={parallelTimer.elapsedMs / parallelTimer.durationMs} label="PAR" />
      )}
      {retranTimer && !retranTimer.complete && (
        <TimerArc cx={455} cy={60} r={14} progress={retranTimer.elapsedMs / retranTimer.durationMs} label="RTR" />
      )}

      {/* 52-T */}
      <line x1="325" y1="90" x2="340" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={354} y={90} breaker={br_t} onClick={() => onBreakerClick?.('52-T')} label="52-T" />
      <line x1="368" y1="90" x2="385" y2="90" stroke="#475569" strokeWidth="2" />

      {/* Bus 2 */}
      <BusLine x={385} y={85} width={160} bus={bus2} label="BUS 2" fillTransition={fillTransition} />

      {/* Load 2 */}
      <LoadSymbol x={465} y={95} loadKW={bus2.loadKW} energized={bus2.energized} />

      {/* 52-M2 */}
      <line x1="545" y1="90" x2="565" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={579} y={90} breaker={br_m2} onClick={() => onBreakerClick?.('52-M2')} label="52-M2" />
      <line x1="593" y1="90" x2="626" y2="90" stroke="#475569" strokeWidth="2" />

      {/* M2 */}
      <circle cx="650" cy="90" r="24" fill="none" stroke={getSourceColor('M2')} strokeWidth="2.5" />
      <text x="650" y="86" textAnchor="middle" fill={getSourceColor('M2')} fontSize="12" fontWeight="bold">M2</text>
      <text x="650" y="100" textAnchor="middle" fill={getSourceColor('M2')} fontSize="9">{m2.voltage.toFixed(0)}%</text>
    </svg>
  );
}

// ─── MMM Layout ──────────────────────────────────────────────────────────────

function MMMLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const fillTransition = speed <= 0.25 ? 'fill 0.4s ease' : 'fill 0.08s ease';
  const m1 = sources.find(s => s.id === 'M1')!;
  const m2 = sources.find(s => s.id === 'M2')!;
  const m3 = sources.find(s => s.id === 'M3')!;
  const br_m1 = breakers.find(b => b.id === '52-M1')!;
  const br_t1 = breakers.find(b => b.id === '52-T1')!;
  const br_t2 = breakers.find(b => b.id === '52-T2')!;
  const br_m3 = breakers.find(b => b.id === '52-M3')!;
  const bus1 = buses.find(b => b.id === 'BUS1')!;
  const bus2 = buses.find(b => b.id === 'BUS2')!;
  const bus3 = buses.find(b => b.id === 'BUS3')!;

  const xferTimer = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retranTimer = activeTimers.find(t => t.id === 'RETRANSFER');

  return (
    <svg viewBox="0 0 900 180" width="100%" style={{ maxHeight: 220 }}>
      {/* M1 */}
      <circle cx="45" cy="90" r="22" fill="none" stroke={getSourceColor('M1')} strokeWidth="2.5" />
      <text x="45" y="86" textAnchor="middle" fill={getSourceColor('M1')} fontSize="11" fontWeight="bold">M1</text>
      <text x="45" y="99" textAnchor="middle" fill={getSourceColor('M1')} fontSize="9">{m1.voltage.toFixed(0)}%</text>

      <line x1="67" y1="90" x2="95" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={109} y={90} breaker={br_m1} onClick={() => onBreakerClick?.('52-M1')} label="52-M1" />
      <line x1="123" y1="90" x2="145" y2="90" stroke="#475569" strokeWidth="2" />

      {/* Bus 1 */}
      <BusLine x={145} y={85} width={130} bus={bus1} label="BUS 1" fillTransition={fillTransition} />
      <LoadSymbol x={210} y={95} loadKW={bus1.loadKW} energized={bus1.energized} />

      {xferTimer && !xferTimer.complete && (
        <TimerArc cx={210} cy={60} r={12} progress={xferTimer.elapsedMs / xferTimer.durationMs} label="XFR" />
      )}

      {/* 52-T1 */}
      <line x1="275" y1="90" x2="295" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={309} y={90} breaker={br_t1} onClick={() => onBreakerClick?.('52-T1')} label="52-T1" />
      <line x1="323" y1="90" x2="345" y2="90" stroke="#475569" strokeWidth="2" />

      {/* Bus 2 — M2 always connected */}
      <BusLine x={345} y={85} width={130} bus={bus2} label="BUS 2" fillTransition={fillTransition} />
      <LoadSymbol x={410} y={95} loadKW={bus2.loadKW} energized={bus2.energized} />

      {/* M2 drops down from bus2 */}
      <line x1="410" y1="85" x2="410" y2="40" stroke="#475569" strokeWidth="1.5" strokeDasharray="4,2" />
      <circle cx="410" cy="25" r="16" fill="none" stroke={getSourceColor('M2')} strokeWidth="2" />
      <text x="410" y="21" textAnchor="middle" fill={getSourceColor('M2')} fontSize="10" fontWeight="bold">M2</text>
      <text x="410" y="33" textAnchor="middle" fill={getSourceColor('M2')} fontSize="8">{m2.voltage.toFixed(0)}%</text>

      {retranTimer && !retranTimer.complete && (
        <TimerArc cx={410} cy={60} r={12} progress={retranTimer.elapsedMs / retranTimer.durationMs} label="RTR" />
      )}

      {/* 52-T2 */}
      <line x1="475" y1="90" x2="495" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={509} y={90} breaker={br_t2} onClick={() => onBreakerClick?.('52-T2')} label="52-T2" />
      <line x1="523" y1="90" x2="545" y2="90" stroke="#475569" strokeWidth="2" />

      {/* Bus 3 */}
      <BusLine x={545} y={85} width={130} bus={bus3} label="BUS 3" fillTransition={fillTransition} />
      <LoadSymbol x={610} y={95} loadKW={bus3.loadKW} energized={bus3.energized} />

      {/* 52-M3 */}
      <line x1="675" y1="90" x2="700" y2="90" stroke="#475569" strokeWidth="2" />
      <BreakerSymbol x={714} y={90} breaker={br_m3} onClick={() => onBreakerClick?.('52-M3')} label="52-M3" />
      <line x1="728" y1="90" x2="755" y2="90" stroke="#475569" strokeWidth="2" />

      {/* M3 */}
      <circle cx="777" cy="90" r="22" fill="none" stroke={getSourceColor('M3')} strokeWidth="2.5" />
      <text x="777" y="86" textAnchor="middle" fill={getSourceColor('M3')} fontSize="11" fontWeight="bold">M3</text>
      <text x="777" y="99" textAnchor="middle" fill={getSourceColor('M3')} fontSize="9">{m3.voltage.toFixed(0)}%</text>
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OneLine({ state, onBreakerClick }: Props) {
  const schemeColor: Record<string, string> = {
    NORMAL_M1: '#22c55e',
    NORMAL_M2: '#3b82f6',
    NORMAL_M3: '#a855f7',
    TIE_FROM_M1: '#22c55e',
    TIE_FROM_M2: '#3b82f6',
    TIE_FROM_M3: '#a855f7',
    BOTH_DEAD: '#ef4444',
    ALL_DEAD: '#ef4444',
    PARALLEL: '#f59e0b',
    LOCKOUT: '#ef4444',
    MANUAL_OVERRIDE: '#8b5cf6',
    INIT: '#64748b',
  };

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>ONE-LINE DIAGRAM</span>
        <span style={{
          background: schemeColor[state.schemeState] ?? '#475569',
          color: '#0f172a',
          padding: '2px 10px',
          borderRadius: '99px',
          fontSize: '0.75rem',
          fontWeight: 700,
          fontFamily: 'monospace',
        }}>
          {state.schemeState}
        </span>
      </div>

      <div style={{
        background: '#1a2744',
        borderRadius: '8px',
        padding: '16px',
        border: '1px solid #1e293b',
      }}>
        {state.topology === 'TWO_SOURCE' && (
          <TwoSourceLayout state={state} onBreakerClick={onBreakerClick} />
        )}
        {state.topology === 'MTM' && (
          <MTMLayout state={state} onBreakerClick={onBreakerClick} />
        )}
        {state.topology === 'MMM' && (
          <MMMLayout state={state} onBreakerClick={onBreakerClick} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
        {[
          { color: COLOR_BREAKER_CLOSED, label: 'Closed' },
          { color: COLOR_BREAKER_OPEN, label: 'Open' },
          { color: COLOR_BREAKER_OPERATING, label: 'Operating' },
          { color: COLOR_ENERGIZED_M1, label: 'M1 fed' },
          { color: COLOR_ENERGIZED_M2, label: 'M2 fed' },
          { color: COLOR_ENERGIZED_M3, label: 'M3 fed' },
          { color: COLOR_DEAD, label: 'Dead' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
