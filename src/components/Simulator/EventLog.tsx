import { useRef, useEffect, useState } from 'react';
import type { SimEvent } from '../../core/types';
import { COLORS } from '../../core/constants';

interface EventLogProps {
  events: SimEvent[];
}

const EVENT_COLORS: Partial<Record<string, string>> = {
  SOURCE_FAILED: COLORS.failed,
  SOURCE_UNHEALTHY: COLORS.failed,
  SOURCE_HEALTHY: COLORS.energized,
  SOURCE_RESTORED: COLORS.energized,
  BREAKER_OPENED: '#94a3b8',
  BREAKER_CLOSED: COLORS.energized,
  BREAKER_TRIPPED: COLORS.tripped,
  TRANSFER_INITIATED: '#f59e0b',
  TRANSFER_COMPLETE: COLORS.energized,
  RETRANSFER_INITIATED: '#f59e0b',
  RETRANSFER_COMPLETE: COLORS.energized,
  BUS_ENERGIZED: COLORS.energized,
  BUS_DEENERGIZED: COLORS.deenergized,
  LOCKOUT_ACTIVATED: COLORS.tripped,
  SYNC_CHECK_PASS: COLORS.energized,
  SYNC_CHECK_FAIL: COLORS.failed,
  WARNING: COLORS.failed,
  INFO: COLORS.textDim,
};

export function EventLog({ events }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const filtered = filter
    ? events.filter((e) =>
      e.message.toLowerCase().includes(filter.toLowerCase()) ||
      e.type.toLowerCase().includes(filter.toLowerCase()) ||
      e.componentTag.toLowerCase().includes(filter.toLowerCase()),
    )
    : events;

  const exportCSV = () => {
    const rows = [['Time (ms)', 'Type', 'Component', 'Message']];
    for (const e of events) {
      rows.push([String(e.timestamp), e.type, e.componentTag, e.message]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ats-events.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0f1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: COLORS.textDim, textTransform: 'uppercase', fontFamily: 'monospace' }}>Event Log</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '3px 8px', color: COLORS.text, fontSize: 12, fontFamily: 'monospace' }}
        />
        <label style={{ fontSize: 12, color: COLORS.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
          Auto-scroll
        </label>
        <button onClick={exportCSV} style={{ padding: '3px 8px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: COLORS.textDim, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
          CSV
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 12, color: COLORS.textDim, fontSize: 12 }}>No events yet. Start simulation.</div>
        )}
        {filtered.map((event, i) => {
          const color = EVENT_COLORS[event.type] ?? COLORS.text;
          return (
            <div key={i} style={{ padding: '3px 12px', borderBottom: '1px solid #0f172a', display: 'flex', gap: 12 }}>
              <span style={{ color: COLORS.textDim, minWidth: 80 }}>{event.timestamp.toFixed(0)}ms</span>
              <span style={{ color, minWidth: 80, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{event.componentTag}</span>
              <span style={{ color }}>{event.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
