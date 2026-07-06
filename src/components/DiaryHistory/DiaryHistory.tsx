import { useState } from 'react';
import { motion } from 'framer-motion';
import { TabBar } from './TabBar';
import { DayTabHeader } from './DayTabHeader';
import { DiaryEntryRow } from './DiaryEntryRow';
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
    >
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
          />
        ) : (
          <WeekTabContent
            entries={entries}
            onDaySelect={onDaySelect}
          />
        )}
      </div>
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
}

function DayTabContent({ sessions, selectedDate, onPrev, onNext, onBack }: DayTabProps) {
  return (
    <div>
      <DayTabHeader date={selectedDate} onPrev={onPrev} onNext={onNext} />

      {/* Chart placeholder — replaced by DayChart in U4 */}
      <div style={{
        margin: '0 16px 4px',
        height: 96,
        background: 'var(--oura-surface)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: 10, color: 'var(--oura-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          chart
        </span>
      </div>

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
            <DiaryEntryRow key={entry.id} entry={entry} />
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

function WeekTabContent({ entries: _entries, onDaySelect: _onDaySelect }: WeekTabProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
    }}>
      {/* Replaced by WeekChart in U5 */}
      <span style={{ fontSize: 10, color: 'var(--oura-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        week chart
      </span>
    </div>
  );
}
