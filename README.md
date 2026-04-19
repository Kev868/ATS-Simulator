# ATS Simulator

A production-quality Automatic Transfer Switch (ATS) simulator built with React 18, TypeScript, and Vite. Simulates real-world ATS scheme logic with ANSI protective relay functions, configurable setpoints, and interactive one-line diagrams. Can be utilised similarly to CAD software in creating own simulations

---

## Getting Started

```bash
cd ats-simulator
npm install
npm run dev 
```

Open http://localhost:5173 in your browser.

To build for production:
```bash
npm run build
```

To run tests:
```bash
npm test
# Or in watch mode:
npm run test:watch
```

---

## Supported Topologies

### Two-Source ATS
Simple dual-source scheme with one bus. M1 (preferred) normally closed. M2 (alternate) normally open. On loss of M1, the ATS opens 52-M1 and closes 52-M2.

```
[M1]──[52-M1]──[===BUS 1===]──[52-M2]──[M2]
                      |
                   [LOAD]
```

### Main-Tie-Main (MTM)
Two buses sectioned by a normally-open tie breaker. Each bus has its own main source. On loss of M1, the tie closes so M2 feeds both buses (and vice versa).

```
[M1]──[52-M1]──[==BUS1==]──[52-T]──[==BUS2==]──[52-M2]──[M2]
                    |                     |
                [LOAD1]              [LOAD2]
```

### Main-Main-Main (MMM)
Three buses with two tie breakers. Three sources feed independent buses under normal conditions. Loss of any source causes the adjacent tie to close.

```
[M1]─[52-M1]─[=BUS1=]─[52-T1]─[=BUS2=]─[52-T2]─[=BUS3=]─[52-M3]─[M3]
                 |                  |                  |
             [LOAD1]            [LOAD2]            [LOAD3]
```

---

## ANSI Device Number References

### ANSI 27 — Undervoltage Relay
Monitors source voltage. When voltage falls below the **UV Threshold** (default 85% of nominal) for longer than the **UV Pickup Time** (default 2000ms), a transfer is initiated. Brief sags that restore before pickup expires are ridden through without transfer.

### ANSI 59 — Overvoltage Relay
Monitors source voltage on the high side. When voltage exceeds the **OV Threshold** (default 110%), a transfer is initiated after the **OV Pickup Time** (default 500ms).

### ANSI 81U — Underfrequency Relay
Triggers when source frequency drops below the **UF Threshold** (default 59.0 Hz) for longer than the **UF Pickup Time** (default 2000ms). Only monitors live sources (not dead/unavailable).

### ANSI 81O — Overfrequency Relay
Triggers when source frequency exceeds the **OF Threshold** (default 61.0 Hz) for longer than the **OF Pickup Time** (default 500ms).

### ANSI 25 — Synchronism Check Relay
Used exclusively for **Closed Transition** transfers. Before closing the incoming source onto an energized bus, the 25 relay verifies that:
- Voltage difference (ΔV) ≤ **Sync Check ΔV** (default 5%)
- Frequency difference (Δf) ≤ **Sync Check Δf** (default 0.2 Hz)
- Phase angle difference (Δφ) ≤ **Sync Check Δφ** (default 10°)

If sync check fails, the transfer falls back to Open Transition mode.

### ANSI 86 — Lockout Relay
Prevents excessive automatic transfers. After **Max Transfers** (default 3) operations within the **Transfer Window** (default 60,000ms), the scheme enters **LOCKOUT** state. All automatic transfers are inhibited. A manual reset (Reset Lockout button) is required to resume automatic operation.

---

## Transfer Modes

### Open Transition
The traditional ATS transfer method. The outgoing source breaker opens first, followed by closing the incoming source breaker. There is a brief power interruption (typically 50–200ms depending on breaker operating time). Safest option — no risk of paralleling incompatible sources.

### Closed Transition (Make-Before-Break)
The incoming source is closed first while the outgoing source is still closed. Both sources are briefly in parallel (typically 50–150ms, controlled by **Max Parallel Time**). An ANSI 25 sync check is performed before closing. If sources are out of sync, falls back to Open Transition. Achieves zero-interruption transfer when conditions are met.

### Fast Transfer
Opens outgoing and closes incoming nearly simultaneously (within 3 cycles / ~50ms). Minimizes interruption compared to standard Open Transition while avoiding the sync check requirement of Closed Transition. Suitable when load can tolerate a very brief outage.

---

## How to Use the Simulator

### 1. Select Topology
On startup, choose from Two-Source, Main-Tie-Main, or Main-Main-Main topologies. Each is pre-configured with appropriate breakers and buses.

### 2. Configure the Scheme
In the **Scheme Settings** panel:
- Choose **Transfer Mode** (Open/Closed/Fast)
- Set **Preferred Source** (M1, M2, or Last Live)
- Enable/disable **Auto-Retransfer**
- Adjust **Bus Loads** (kW per bus)
- Configure relay **Setpoints** in the Setpoints tab

### 3. Run a Scenario
Use the **Scenarios** panel to load preset scenarios or create custom ones. Click **Load & Run** to start the simulation.

**Preset Scenarios:**
- **Loss of Preferred Source** — M1 fails at t=3s
- **Brief Voltage Sag (rides through)** — M1 sags to 80% but restores before pickup
- **Sustained Voltage Sag (transfers)** — M1 stays at 80%, pickup fires, transfer occurs
- **Failed Closed Transition** — M2 is 30° out of phase, sync check blocks closed transition
- **Successful Closed Transition** — Sources in sync, make-before-break transfer completes
- **Loss of Both Sources** — Both sources fail, buses go dead
- **Auto-Retransfer** — M1 fails, transfers to M2, M1 restores, auto-retransfers back

### 4. Manual Control
- Drag sliders in **Source Panels** to change voltage, frequency, or phase angle
- Toggle **AVAIL/UNAVAIL** to instantly kill or restore a source
- Click **breakers** on the one-line diagram to manually open/close (interlocks enforced)
- Use **Step** button to advance 10ms at a time for detailed inspection

### 5. Monitor the Log
The **Event Log** on the right captures every relay operation, timer event, breaker command, and state transition. Filter by severity (INFO, WARN, ALARM, ACTION) and export as CSV.

### 6. Simulation Controls
- **Start / Pause** — Run or pause the simulation
- **Step** — Advance one 10ms tick
- **Reset** — Return to initial state
- **Speed** — 0.5x to 10x real-time

---

## Architecture

### Engine (Pure Functions, No Side Effects)

All simulation logic lives in `src/engine/` and uses only pure functions:

| File | Purpose |
|------|---------|
| `types.ts` | All shared TypeScript types |
| `breakerFSM.ts` | Breaker state machine (OPEN/CLOSING/CLOSED/TRIPPING) |
| `sourceMonitor.ts` | ANSI 27/59/81U/81O relay evaluation |
| `syncCheck.ts` | ANSI 25 sync check relay |
| `schemeController.ts` | Main ATS scheme FSM, interlocks, bus energization |
| `scenarioRunner.ts` | Preset scenario definitions and event applicator |
| `atsEngine.ts` | Top-level `createInitialState` and `stepSimulation` |

### State Management
All state is held in React via `useSimulation` hook. No external state management library. The simulation loop uses `setInterval` at 50ms real-time, computing `dt = 50 * speed` milliseconds of simulated time per tick.

All timers are elapsed-time counters in state — never `setTimeout`. This makes the engine fully testable and deterministic.

---

## Running Tests

```bash
npm test
```

Tests cover:
1. Open transition on source loss (MTM)
2. Auto-retransfer after preferred restoration
3. Blocked closed transition (out of sync)
4. Successful closed transition (in sync)
5. Interlock rejection (anti-paralleling)
6. UV pickup delay ride-through
7. Lockout after excessive transfers
8. Two-source basic transfer
9. Bus dead-bus detection
