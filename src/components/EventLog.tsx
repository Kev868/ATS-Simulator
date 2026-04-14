import React, { useEffect, useRef } from 'react';
import { LogEvent, LogSeverity } from '../engine/types';

interface Props {
  events: LogEvent[];
  onExport?: () => void;
}

const severityColor: Record<LogSeverity, { bg: string; text: string; border: string }> = {
  INFO:   { bg: '#1e293b', text: '#94a3b8', border: '#334155' },
  WARN:   { bg: '#78350f22', text: '#fbbf24', border: '#92400e66' },
  ALARM:  { bg: '#7f1d1d22', text: '#f87171', border: '#991b1b66' },
  ACTION: { bg: '#1e3a5f22', text: '#60a5fa', border: '#1d4ed866' },
};

function formatSimTime(ms: number): string {
  const s = ms / 1000;
  return `T+${s.toFixed(3)}s`;
}

export default function EventLog({ events, onExport }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [filter, setFilter] = React.useState<LogSeverity | 'ALL'>('ALL');

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    setAutoScroll(atBottom);
  };

  const filtered = filter === 'ALL' ? events : events.filter(e => e.severity === filter);

  const filterButtonStyle = (sev: LogSeverity | 'ALL'): React.CSSProperties => {
    const isActive = filter === sev;
    if (sev === 'ALL') {
      return {
        padding: '2px 8px',
        background: isActive ? '#334155' : 'transparent',
        color: isActive ? '#e2e8f0' : '#64748b',
        border: `1px solid ${isActive ? '#475569' : '#334155'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.7rem',
      };
    }
    const colors = severityColor[sev];
    return {
      padding: '2px 8px',
      background: isActive ? colors.bg : 'transparent',
      color: isActive ? colors.text : '#64748b',
      border: `1px solid ${isActive ? colors.border : '#334155'}`,
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '0.7rem',
    };
  };

  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em' }}>
          EVENT LOG ({events.length})
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(['ALL', 'INFO', 'WARN', 'ALARM', 'ACTION'] as (LogSeverity | 'ALL')[]).map(sev => (
            <button key={sev} style={filterButtonStyle(sev)} onClick={() => setFilter(sev)}>
              {sev}
            </button>
          ))}
          {onExport && (
            <button
              onClick={onExport}
              style={{
                padding: '2px 8px',
                background: '#0f172a',
                color: '#64748b',
                border: '1px solid #334155',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
              }}
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Events */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '4px 0',
          fontFamily: 'monospace',
          fontSize: '0.72rem',
        }}
      >
        {filtered.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>
            No events
          </div>
        )}
        {filtered.map(event => {
          const colors = severityColor[event.severity];
          return (
            <div
              key={event.id}
              style={{
                padding: '3px 10px',
                borderLeft: `3px solid ${colors.border}`,
                marginBottom: '2px',
                background: colors.bg,
              }}
            >
              <span style={{ color: '#475569', marginRight: '8px' }}>
                {formatSimTime(event.simTimeMs)}
              </span>
              <span style={{
                color: colors.text,
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                padding: '0 4px',
                borderRadius: '2px',
                marginRight: '8px',
                fontSize: '0.65rem',
              }}>
                {event.severity}
              </span>
              <span style={{ color: colors.text }}>{event.message}</span>
              {event.detail && (
                <div style={{ color: '#475569', paddingLeft: '16px', marginTop: '1px' }}>
                  {event.detail}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div
          style={{
            textAlign: 'center',
            padding: '4px',
            background: '#334155',
            color: '#94a3b8',
            fontSize: '0.7rem',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          ↓ New events — click to scroll
        </div>
      )}
    </div>
  );
}
