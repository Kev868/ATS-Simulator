// ─── IEEE/ANSI Engineering One-Line Diagram ───────────────────────────────────
// Drawing conventions enforced:
//   Buses       — 4 px thick solid horizontal lines
//   Feeders     — 2 px orthogonal wires (Manhattan routing, no diagonals)
//   Breakers    — 14×14 px square; OPEN = hollow + NW-SE slash, CLOSED = filled
//   Sources     — circle, ~ sinusoidal inscription, label above
//   Loads       — labeled rectangle + 3-line ground symbol
//   Labels      — Courier New / monospace, fixed 9 px, device-number above symbol
//   Color       — bodies are monochrome (BODY); energization state is the ONLY
//                 thing that adds color (green/blue/purple per source, amber fault)
//   No gradients, rounded corners on symbols, icons, or decorative elements.

import React from 'react';
import { SimState, Breaker, Bus } from '../engine/types';

interface Props {
  state: SimState;
  onBreakerClick?: (breakerId: string) => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const BODY      = '#94a3b8'; // monochrome component body (slate-400)
const BODY_FILL = '#0d1b2e'; // component interior fill
const DE_ENRG   = '#334155'; // de-energized wire/bus
const C_M1      = '#22c55e'; // M1 energized — green
const C_M2      = '#3b82f6'; // M2 energized — blue
const C_M3      = '#a855f7'; // M3 energized — purple
const C_FAULT   = '#f59e0b'; // fault / operating — amber
const BUS_W     = 4;
const WIRE_W    = 2;
const FONT      = "'Courier New', 'Consolas', monospace";
const LABEL_SZ  = 9;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function srcColor(sourceId: string | null): string {
  if (sourceId === 'M1') return C_M1;
  if (sourceId === 'M2') return C_M2;
  if (sourceId === 'M3') return C_M3;
  return DE_ENRG;
}

function busColor(bus: Bus): string {
  return bus.energized ? srcColor(bus.sourceId) : DE_ENRG;
}

function wireColor(bus: Bus | null): string {
  if (!bus) return DE_ENRG;
  return bus.energized ? srcColor(bus.sourceId) : DE_ENRG;
}

// ─── Primitive: wire segment (feeder) ────────────────────────────────────────

function W({ x1, y1, x2, y2, color = BODY }: {
  x1: number; y1: number; x2: number; y2: number; color?: string;
}) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={WIRE_W} strokeLinecap="square" />;
}

// ─── Breaker symbol (ANSI 52) ─────────────────────────────────────────────────
// Horizontal breaker: ports on left and right face.
// OPEN:   hollow box + diagonal slash (NW→SE)
// CLOSED: solid box, no slash
// TRANS:  dashed outline, amber, blinking

interface BkrProps {
  cx: number; cy: number;
  br: Breaker;
  onClick?: () => void;
}

function BreakerSym({ cx, cy, br, onClick }: BkrProps) {
  const H  = 14; // half-width/height of breaker square
  const isOpen      = br.state === 'OPEN';
  const isClosed    = br.state === 'CLOSED';
  const isTransient = br.state === 'CLOSING' || br.state === 'TRIPPING';

  const stroke = isTransient ? C_FAULT : BODY;
  const fill   = isClosed    ? BODY    : BODY_FILL;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }} role={onClick ? 'button' : undefined}>
      {/* Body */}
      <rect
        x={cx - H / 2} y={cy - H / 2}
        width={H} height={H}
        fill={fill} stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={isTransient ? '3,2' : undefined}
      >
        {isTransient && (
          <animate attributeName="opacity" values="1;0.25;1" dur="0.5s" repeatCount="indefinite" />
        )}
      </rect>

      {/* OPEN slash — NW to SE diagonal */}
      {isOpen && (
        <line
          x1={cx - H / 2 + 2} y1={cy - H / 2 + 2}
          x2={cx + H / 2 - 2} y2={cy + H / 2 - 2}
          stroke={BODY} strokeWidth={1.5}
        />
      )}

      {/* ANSI device number above */}
      <text x={cx} y={cy - H / 2 - 3}
        textAnchor="middle" fill={BODY}
        fontSize={LABEL_SZ - 1} fontFamily={FONT} fontWeight="600">
        52
      </text>

      {/* Tag below */}
      <text x={cx} y={cy + H / 2 + 10}
        textAnchor="middle" fill={BODY}
        fontSize={LABEL_SZ - 1} fontFamily={FONT}>
        {br.label}
      </text>
    </g>
  );
}

// ─── Source symbol ────────────────────────────────────────────────────────────
// Circle with a sinusoidal arc inside, tag above, voltage% below.

interface SrcProps { cx: number; cy: number; id: string; voltage: number; available: boolean; }

function SourceSym({ cx, cy, id, voltage, available }: SrcProps) {
  const r = 22;
  const alive = available && voltage > 0;
  const color = alive
    ? id === 'M1' ? C_M1 : id === 'M2' ? C_M2 : C_M3
    : DE_ENRG;

  // Sine-wave approximation (S-curve across circle interior)
  const sw = r * 0.7;
  const sinePath = `M${cx - sw},${cy} C${cx - sw * 0.5},${cy - sw * 0.5} ${cx + sw * 0.5},${cy + sw * 0.5} ${cx + sw},${cy}`;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BODY_FILL} stroke={color} strokeWidth={2} />
      <path d={sinePath} fill="none" stroke={color} strokeWidth={1.5} />

      {/* Tag */}
      <text x={cx} y={cy - r - 5}
        textAnchor="middle" fill={color}
        fontSize={LABEL_SZ} fontFamily={FONT} fontWeight="700" letterSpacing="0.04em">
        {id}
      </text>

      {/* Voltage readout */}
      <text x={cx} y={cy + r + 13}
        textAnchor="middle" fill={color}
        fontSize={LABEL_SZ - 1} fontFamily={FONT}>
        {voltage.toFixed(0)}%
      </text>
    </g>
  );
}

// ─── Bus segment ──────────────────────────────────────────────────────────────

interface BusLineProps { x1: number; y: number; x2: number; bus: Bus; label: string; fillTransition?: string; }

function BusLine({ x1, y, x2, bus, label, fillTransition }: BusLineProps) {
  const color = busColor(bus);
  const mid   = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y}
        stroke={color} strokeWidth={BUS_W} strokeLinecap="square"
        style={fillTransition ? { transition: `stroke ${fillTransition}` } : undefined}
      />
      <text x={mid} y={y - 7}
        textAnchor="middle" fill={color}
        fontSize={LABEL_SZ} fontFamily={FONT} fontWeight="700" letterSpacing="0.08em">
        {label}
      </text>
    </g>
  );
}

// ─── Load symbol ──────────────────────────────────────────────────────────────
// IEEE: labeled block rectangle + 3-line ground symbol below

interface LoadProps { cx: number; topY: number; loadKW: number; bus: Bus | null; }

function LoadSym({ cx, topY, loadKW, bus }: LoadProps) {
  const alive = bus?.energized ?? false;
  const color = alive ? srcColor(bus?.sourceId ?? null) : DE_ENRG;
  const bw = 36; const bh = 22;

  return (
    <g>
      {/* Drop feeder */}
      <W x1={cx} y1={topY} x2={cx} y2={topY + 10} color={color} />
      {/* Load block */}
      <rect x={cx - bw / 2} y={topY + 10} width={bw} height={bh}
        fill={BODY_FILL} stroke={color} strokeWidth={1.5} />
      <text x={cx} y={topY + 10 + bh / 2 + 4}
        textAnchor="middle" fill={color}
        fontSize={LABEL_SZ - 1} fontFamily={FONT}>
        {loadKW}kW
      </text>
      {/* IEEE ground: three descending lines */}
      <W x1={cx} y1={topY + 10 + bh} x2={cx} y2={topY + 10 + bh + 8} color={color} />
      <line x1={cx - 12} y1={topY + 10 + bh + 8}  x2={cx + 12} y2={topY + 10 + bh + 8}  stroke={color} strokeWidth={1.5} />
      <line x1={cx - 8}  y1={topY + 10 + bh + 12} x2={cx + 8}  y2={topY + 10 + bh + 12} stroke={color} strokeWidth={1.5} />
      <line x1={cx - 4}  y1={topY + 10 + bh + 16} x2={cx + 4}  y2={topY + 10 + bh + 16} stroke={color} strokeWidth={1.5} />
    </g>
  );
}

// ─── Timer arc ────────────────────────────────────────────────────────────────

function TimerArc({ cx, cy, r, progress, label }: {
  cx: number; cy: number; r: number; progress: number; label: string;
}) {
  const angle = Math.min(progress, 0.9999) * 360;
  const rad   = (angle - 90) * (Math.PI / 180);
  const ex    = cx + r * Math.cos(rad);
  const ey    = cy + r * Math.sin(rad);
  const large = angle > 180 ? 1 : 0;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={3} />
      {progress > 0 && (
        <path d={`M${cx},${cy - r} A${r},${r} 0 ${large} 1 ${ex},${ey}`}
          fill="none" stroke={C_FAULT} strokeWidth={3} strokeLinecap="round" />
      )}
      <text x={cx} y={cy + 3} textAnchor="middle"
        fill={C_FAULT} fontSize={7} fontFamily={FONT}>{label}</text>
    </g>
  );
}

// ─── TWO_SOURCE layout ────────────────────────────────────────────────────────
// M1 ──[52-M1]────── BUS-1 ──────[52-M2]── M2
//                       |
//                     LOAD

function TwoSourceLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const m1    = sources.find(s => s.id === 'M1')!;
  const m2    = sources.find(s => s.id === 'M2')!;
  const brM1  = breakers.find(b => b.id === '52-M1')!;
  const brM2  = breakers.find(b => b.id === '52-M2')!;
  const bus1  = buses.find(b => b.id === 'BUS1')!;
  const trans = speed <= 0.25 ? 'stroke 0.4s ease' : undefined;

  const xferT = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retrT = activeTimers.find(t => t.id === 'RETRANSFER');

  // Grid-snapped layout (all coords multiples of 20)
  const busY = 100;
  const srcY = busY;
  // Bus from x=180 to x=500
  const busX1 = 180; const busX2 = 500;
  const brM1X = 140; const brM2X = 540;
  const m1X   =  60; const m2X   = 620;
  const loadX = 340; const loadY = busY + 20;
  const fcB1  = bus1.energized ? srcColor(bus1.sourceId) : DE_ENRG;

  return (
    <svg viewBox="0 0 700 220" width="100%" style={{ maxHeight: 220 }}>
      {/* M1 source */}
      <SourceSym cx={m1X} cy={srcY} id="M1" voltage={m1.voltage} available={m1.available} />

      {/* M1→brM1 feeder */}
      <W x1={m1X + 22} y1={srcY} x2={brM1X - 7} y2={srcY} color={m1.available ? C_M1 : DE_ENRG} />

      {/* 52-M1 */}
      <BreakerSym cx={brM1X} cy={srcY} br={brM1} onClick={() => onBreakerClick?.('52-M1')} />

      {/* brM1→bus feeder */}
      <W x1={brM1X + 7} y1={srcY} x2={busX1} y2={srcY} color={fcB1} />

      {/* BUS-1 */}
      <BusLine x1={busX1} y={busY} x2={busX2} bus={bus1} label="BUS-1" fillTransition={trans} />

      {/* Vertical drop to load */}
      <W x1={loadX} y1={busY + 2} x2={loadX} y2={loadY} color={fcB1} />

      {/* LOAD */}
      <LoadSym cx={loadX} topY={loadY} loadKW={bus1.loadKW} bus={bus1} />

      {/* bus→brM2 feeder */}
      <W x1={busX2} y1={busY} x2={brM2X - 7} y2={busY} color={fcB1} />

      {/* 52-M2 */}
      <BreakerSym cx={brM2X} cy={srcY} br={brM2} onClick={() => onBreakerClick?.('52-M2')} />

      {/* brM2→M2 feeder */}
      <W x1={brM2X + 7} y1={srcY} x2={m2X - 22} y2={srcY} color={m2.available ? C_M2 : DE_ENRG} />

      {/* M2 source */}
      <SourceSym cx={m2X} cy={srcY} id="M2" voltage={m2.voltage} available={m2.available} />

      {/* Timer arcs */}
      {xferT && !xferT.complete && (
        <TimerArc cx={loadX} cy={busY - 30} r={16}
          progress={xferT.elapsedMs / xferT.durationMs} label="XFR" />
      )}
      {retrT && !retrT.complete && (
        <TimerArc cx={loadX + 40} cy={busY - 30} r={16}
          progress={retrT.elapsedMs / retrT.durationMs} label="RTR" />
      )}
    </svg>
  );
}

// ─── MTM layout ───────────────────────────────────────────────────────────────
// M1 ──[52-M1]── BUS-A ──[52-T]── BUS-B ──[52-M2]── M2
//                  |                  |
//               LOAD-A            LOAD-B

function MTMLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const m1    = sources.find(s => s.id === 'M1')!;
  const m2    = sources.find(s => s.id === 'M2')!;
  const brM1  = breakers.find(b => b.id === '52-M1')!;
  const brT   = breakers.find(b => b.id === '52-T')!;
  const brM2  = breakers.find(b => b.id === '52-M2')!;
  const bus1  = buses.find(b => b.id === 'BUS1')!;
  const bus2  = buses.find(b => b.id === 'BUS2')!;
  const trans = speed <= 0.25 ? 'stroke 0.4s ease' : undefined;

  const xferT  = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retrT  = activeTimers.find(t => t.id === 'RETRANSFER');
  const parT   = activeTimers.find(t => t.id === 'PARALLEL_TIMER');

  // Layout
  const busY = 100;
  const m1X  =  60;  const m2X   = 780;
  const brM1X = 120; const brM2X = 720;
  const busAX1 = 160; const busAX2 = 340;
  const busBX1 = 500; const busBX2 = 680;
  const brTX  = 420;
  const loadAX = 250; const loadBX = 590;
  const loadY  = busY + 20;
  const fcB1 = bus1.energized ? srcColor(bus1.sourceId) : DE_ENRG;
  const fcB2 = bus2.energized ? srcColor(bus2.sourceId) : DE_ENRG;

  return (
    <svg viewBox="0 0 860 240" width="100%" style={{ maxHeight: 240 }}>
      {/* M1 */}
      <SourceSym cx={m1X} cy={busY} id="M1" voltage={m1.voltage} available={m1.available} />
      <W x1={m1X + 22} y1={busY} x2={brM1X - 7} y2={busY} color={m1.available ? C_M1 : DE_ENRG} />
      <BreakerSym cx={brM1X} cy={busY} br={brM1} onClick={() => onBreakerClick?.('52-M1')} />
      <W x1={brM1X + 7} y1={busY} x2={busAX1} y2={busY} color={fcB1} />

      {/* BUS-A */}
      <BusLine x1={busAX1} y={busY} x2={busAX2} bus={bus1} label="BUS-A" fillTransition={trans} />
      <W x1={loadAX} y1={busY + 2} x2={loadAX} y2={loadY} color={fcB1} />
      <LoadSym cx={loadAX} topY={loadY} loadKW={bus1.loadKW} bus={bus1} />

      {/* Bus A → 52-T */}
      <W x1={busAX2} y1={busY} x2={brTX - 7} y2={busY} color={fcB1} />
      <BreakerSym cx={brTX} cy={busY} br={brT} onClick={() => onBreakerClick?.('52-T')} />
      <W x1={brTX + 7} y1={busY} x2={busBX1} y2={busY} color={fcB2} />

      {/* BUS-B */}
      <BusLine x1={busBX1} y={busY} x2={busBX2} bus={bus2} label="BUS-B" fillTransition={trans} />
      <W x1={loadBX} y1={busY + 2} x2={loadBX} y2={loadY} color={fcB2} />
      <LoadSym cx={loadBX} topY={loadY} loadKW={bus2.loadKW} bus={bus2} />

      {/* BUS-B → 52-M2 → M2 */}
      <W x1={busBX2} y1={busY} x2={brM2X - 7} y2={busY} color={fcB2} />
      <BreakerSym cx={brM2X} cy={busY} br={brM2} onClick={() => onBreakerClick?.('52-M2')} />
      <W x1={brM2X + 7} y1={busY} x2={m2X - 22} y2={busY} color={m2.available ? C_M2 : DE_ENRG} />
      <SourceSym cx={m2X} cy={busY} id="M2" voltage={m2.voltage} available={m2.available} />

      {/* Timer arcs — anchored to the tie region */}
      {xferT && !xferT.complete && (
        <TimerArc cx={loadAX} cy={busY - 36} r={16}
          progress={xferT.elapsedMs / xferT.durationMs} label="XFR" />
      )}
      {parT && !parT.complete && (
        <TimerArc cx={brTX} cy={busY - 36} r={18}
          progress={parT.elapsedMs / parT.durationMs} label="PAR" />
      )}
      {retrT && !retrT.complete && (
        <TimerArc cx={loadBX} cy={busY - 36} r={16}
          progress={retrT.elapsedMs / retrT.durationMs} label="RTR" />
      )}
    </svg>
  );
}

// ─── MMM layout ───────────────────────────────────────────────────────────────

function MMMLayout({ state, onBreakerClick }: Props) {
  const { sources, breakers, buses, activeTimers, speed } = state;
  const m1   = sources.find(s => s.id === 'M1')!;
  const m2   = sources.find(s => s.id === 'M2')!;
  const m3   = sources.find(s => s.id === 'M3')!;
  const brM1 = breakers.find(b => b.id === '52-M1')!;
  const brT1 = breakers.find(b => b.id === '52-T1')!;
  const brT2 = breakers.find(b => b.id === '52-T2')!;
  const brM3 = breakers.find(b => b.id === '52-M3')!;
  const bus1 = buses.find(b => b.id === 'BUS1')!;
  const bus2 = buses.find(b => b.id === 'BUS2')!;
  const bus3 = buses.find(b => b.id === 'BUS3')!;
  const trans = speed <= 0.25 ? 'stroke 0.4s ease' : undefined;

  const xferT = activeTimers.find(t => t.id === 'XFER_DELAY');
  const retrT = activeTimers.find(t => t.id === 'RETRANSFER');

  const busY = 110;
  const loadY = busY + 24;

  // Horizontal layout across 1000px
  const m1X    =  60;
  const brM1X  = 120;
  const bus1X1 = 160; const bus1X2 = 280;
  const load1X = 220;
  const brT1X  = 320;
  const bus2X1 = 360; const bus2X2 = 560;
  const load2X = 460; // M2 drop here
  const m2dropY = 50; // M2 source above BUS-2
  const brT2X  = 600;
  const bus3X1 = 640; const bus3X2 = 760;
  const load3X = 700;
  const brM3X  = 800;
  const m3X    = 860;

  const fcB1 = bus1.energized ? srcColor(bus1.sourceId) : DE_ENRG;
  const fcB2 = bus2.energized ? srcColor(bus2.sourceId) : DE_ENRG;
  const fcB3 = bus3.energized ? srcColor(bus3.sourceId) : DE_ENRG;

  return (
    <svg viewBox="0 0 940 260" width="100%" style={{ maxHeight: 260 }}>
      {/* M1 */}
      <SourceSym cx={m1X} cy={busY} id="M1" voltage={m1.voltage} available={m1.available} />
      <W x1={m1X + 22} y1={busY} x2={brM1X - 7} y2={busY} color={m1.available ? C_M1 : DE_ENRG} />
      <BreakerSym cx={brM1X} cy={busY} br={brM1} onClick={() => onBreakerClick?.('52-M1')} />
      <W x1={brM1X + 7} y1={busY} x2={bus1X1} y2={busY} color={fcB1} />

      {/* BUS-1 */}
      <BusLine x1={bus1X1} y={busY} x2={bus1X2} bus={bus1} label="BUS-1" fillTransition={trans} />
      <W x1={load1X} y1={busY + 2} x2={load1X} y2={loadY} color={fcB1} />
      <LoadSym cx={load1X} topY={loadY} loadKW={bus1.loadKW} bus={bus1} />

      {/* BUS-1 → 52-T1 */}
      <W x1={bus1X2} y1={busY} x2={brT1X - 7} y2={busY} color={fcB1} />
      <BreakerSym cx={brT1X} cy={busY} br={brT1} onClick={() => onBreakerClick?.('52-T1')} />
      <W x1={brT1X + 7} y1={busY} x2={bus2X1} y2={busY} color={fcB2} />

      {/* BUS-2 */}
      <BusLine x1={bus2X1} y={busY} x2={bus2X2} bus={bus2} label="BUS-2" fillTransition={trans} />

      {/* M2 drops vertically to BUS-2 */}
      <SourceSym cx={load2X} cy={m2dropY} id="M2" voltage={m2.voltage} available={m2.available} />
      <W x1={load2X} y1={m2dropY + 22} x2={load2X} y2={busY} color={m2.available ? C_M2 : DE_ENRG} />

      {/* BUS-2 → 52-T2 */}
      <W x1={bus2X2} y1={busY} x2={brT2X - 7} y2={busY} color={fcB2} />
      <BreakerSym cx={brT2X} cy={busY} br={brT2} onClick={() => onBreakerClick?.('52-T2')} />
      <W x1={brT2X + 7} y1={busY} x2={bus3X1} y2={busY} color={fcB3} />

      {/* BUS-3 */}
      <BusLine x1={bus3X1} y={busY} x2={bus3X2} bus={bus3} label="BUS-3" fillTransition={trans} />
      <W x1={load3X} y1={busY + 2} x2={load3X} y2={loadY} color={fcB3} />
      <LoadSym cx={load3X} topY={loadY} loadKW={bus3.loadKW} bus={bus3} />

      {/* BUS-3 → 52-M3 → M3 */}
      <W x1={bus3X2} y1={busY} x2={brM3X - 7} y2={busY} color={fcB3} />
      <BreakerSym cx={brM3X} cy={busY} br={brM3} onClick={() => onBreakerClick?.('52-M3')} />
      <W x1={brM3X + 7} y1={busY} x2={m3X - 22} y2={busY} color={m3.available ? C_M3 : DE_ENRG} />
      <SourceSym cx={m3X} cy={busY} id="M3" voltage={m3.voltage} available={m3.available} />

      {/* Timer arcs */}
      {xferT && !xferT.complete && (
        <TimerArc cx={load1X} cy={busY - 40} r={14}
          progress={xferT.elapsedMs / xferT.durationMs} label="XFR" />
      )}
      {retrT && !retrT.complete && (
        <TimerArc cx={load3X} cy={busY - 40} r={14}
          progress={retrT.elapsedMs / retrT.durationMs} label="RTR" />
      )}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: C_M1,    label: 'M1 energized' },
  { color: C_M2,    label: 'M2 energized' },
  { color: C_M3,    label: 'M3 energized' },
  { color: DE_ENRG, label: 'De-energized' },
  { color: C_FAULT, label: 'Operating / fault' },
  { color: BODY,    label: 'Device body' },
];

export default function OneLine({ state, onBreakerClick }: Props) {
  return (
    <div style={{ padding: '16px' }}>
      {/* Diagram title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginBottom: '8px',
        borderBottom: '1px solid #1e293b', paddingBottom: '6px',
      }}>
        <span style={{
          color: BODY, fontSize: '0.72rem', fontFamily: FONT,
          letterSpacing: '0.1em', fontWeight: 700,
        }}>
          ONE-LINE DIAGRAM — {state.topology}
        </span>
        <span style={{
          color: '#475569', fontSize: '0.7rem', fontFamily: FONT,
          letterSpacing: '0.06em',
        }}>
          IEEE/ANSI STD 315
        </span>
      </div>

      {/* Drawing area */}
      <div style={{
        background: '#0a1020',
        border: '1px solid #1e293b',
        borderRadius: '4px',
        padding: '16px',
        overflow: 'hidden',
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

      {/* Legend — only technical items, no decorative elements */}
      <div style={{
        display: 'flex', gap: '20px', marginTop: '8px',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {LEGEND_ITEMS.map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: 20, height: 3, background: color }} />
            <span style={{ color: '#475569', fontSize: '0.68rem', fontFamily: FONT }}>
              {label}
            </span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" fill={BODY_FILL} stroke={BODY} strokeWidth="1.5" />
            <line x1="3" y1="3" x2="11" y2="11" stroke={BODY} strokeWidth="1.5" />
          </svg>
          <span style={{ color: '#475569', fontSize: '0.68rem', fontFamily: FONT }}>52 open</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <svg width="14" height="14">
            <rect x="1" y="1" width="12" height="12" fill={BODY} stroke={BODY} strokeWidth="1.5" />
          </svg>
          <span style={{ color: '#475569', fontSize: '0.68rem', fontFamily: FONT }}>52 closed</span>
        </div>
      </div>
    </div>
  );
}
