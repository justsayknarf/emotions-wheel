import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { TabBar } from './TabBar';
import { DayTabHeader } from './DayTabHeader';
import { DiaryEntryRow } from './DiaryEntryRow';
import { DayChart } from './DayChart';
import { WeekChart } from './WeekChart';
import { SessionDetailCard } from './SessionDetailCard';
import { sessionsForDay } from '../../utils/diaryAggregation';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];
  onBack: () => void;
}

export function DiaryHistory({ entries, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [openEntry, setOpenEntry] = useState<DiaryEntry | null>(null);
  const swipeCloseRef = useRef<{ x: number; y: number } | null>(null);

  function onDaySelect(date: Date) {
    setSelectedDate(date);
    setActiveTab('day');
  }

  function shiftDate(delta: number) {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      return next;
    });
  }

  const daySessions = sessionsForDay(entries, selectedDate).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--oura-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDownCapture={(e) => {
        // Edge swipe to close — only from left 40px to avoid WeekChart conflict
        if (openEntry === null && e.clientX <= 40) {
          swipeCloseRef.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onPointerMoveCapture={(e) => {
        if (!swipeCloseRef.current) return;
        const dx = e.clientX - swipeCloseRef.current.x;
        const dy = e.clientY - swipeCloseRef.current.y;
        if (dx > 80 && Math.abs(dx) / Math.abs(dy || 1) > 2) {
          swipeCloseRef.current = null;
          onBack();
        }
      }}
      onPointerUpCapture={() => { swipeCloseRef.current = null; }}
      onPointerCancelCapture={() => { swipeCloseRef.current = null; }}
    >
      {/* Centered column — constrains content to phone width on desktop */}
      <div style={{ maxWidth: 430, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '20px 20px 12px',
        borderBottom: '1px solid var(--oura-border)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--oura-text-2)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '6px 0',
            marginRight: 12,
            letterSpacing: '0.01em',
          }}
        >
          ← Back
        </button>
        <h1 style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--oura-gold-dim)',
          margin: 0,
        }}>
          Check-in history
        </h1>
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>
        {activeTab === 'day' ? (
          <DayTabContent
            sessions={daySessions}
            selectedDate={selectedDate}
            onPrev={() => shiftDate(-1)}
            onNext={() => shiftDate(1)}
            onBack={onBack}
            onOpenEntry={setOpenEntry}
          />
        ) : (
          <WeekTabContent
            entries={entries}
            onDaySelect={onDaySelect}
          />
        )}
      </div>

      </div>{/* end centered column */}

      {/* Session detail overlay — outside the centered column so it spans full screen */}
      <SessionDetailCard entry={openEntry} onDismiss={() => setOpenEntry(null)} />
    </div>
  );
}

// ─── Day tab ─────────────────────────────────────────────────────────────────

interface DayTabProps {
  sessions: DiaryEntry[];
  selectedDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onOpenEntry: (entry: DiaryEntry) => void;
}

function DayTabContent({ sessions, selectedDate, onPrev, onNext, onBack, onOpenEntry }: DayTabProps) {
  return (
    <div>
      <DayTabHeader date={selectedDate} onPrev={onPrev} onNext={onNext} />

      <DayChart sessions={sessions} onDotTap={onOpenEntry} />

      {/* Session list */}
      <div style={{ padding: '0 20px' }}>
        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 48,
              gap: 16,
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 15, color: 'var(--oura-text-3)', margin: 0, fontWeight: 300 }}>
              No check-ins on this day.
            </p>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid var(--oura-border)',
                borderRadius: 6,
                color: 'var(--oura-gold)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Start a check-in
            </button>
          </motion.div>
        ) : (
          sessions.map((entry) => (
            <DiaryEntryRow key={entry.id} entry={entry} onClick={() => onOpenEntry(entry)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Week tab ────────────────────────────────────────────────────────────────

interface WeekTabProps {
  entries: DiaryEntry[];
  onDaySelect: (date: Date) => void;
}

function WeekTabContent({ entries, onDaySelect }: WeekTabProps) {
  return (
    <div style={{ padding: '12px 0' }}>
      <WeekChart entries={entries} onDayTap={onDaySelect} />
    </div>
  );
}
