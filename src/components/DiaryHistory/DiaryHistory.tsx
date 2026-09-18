import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CSSProperties } from 'react';
import { DayTabHeader } from './DayTabHeader';
import { DiaryEntryRow } from './DiaryEntryRow';
import { DailySummaryRow } from './DailySummaryRow';
import { DayChart } from './DayChart';
import { WeekChart } from './WeekChart';
import { MiniCircumplex } from './MiniCircumplex';
import { SessionDetailCard } from './SessionDetailCard';
import { sessionsForDay, entriesInWindow, hasSpreadCoverage, last7Days, groupByDay, dateKey } from '../../utils/diaryAggregation';
import { downloadDiaryCsv } from '../../utils/diaryCsv';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];
  onBack: () => void;
}

// Shared shape for the two "go back one level" text buttons (outer header,
// day-detail's in-app control) -- only size/weight differ between them.
function backButtonStyle(fontSize: number): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    color: 'var(--ui-text-2)',
    cursor: 'pointer',
    fontSize,
  };
}

// Week/day-detail swap: same fade + horizontal-offset shape, opposite sign
// per direction (week slides in from the left, day-detail from the right).
const screenTransition = { duration: 0.2 };
function screenMotionProps(offsetX: number) {
  return {
    initial: { opacity: 0, x: offsetX },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: offsetX },
    transition: screenTransition,
  };
}

export function DiaryHistory({ entries, onBack }: Props) {
  const [dayDetailFor, setDayDetailFor] = useState<Date | null>(null);
  const [openEntry, setOpenEntry] = useState<DiaryEntry | null>(null);
  const swipeCloseRef = useRef<{ x: number; y: number } | null>(null);

  // Gated on dayDetailFor: while day-detail is open, this pops back to the
  // week screen first; only when it's already null does it reach the
  // App-level onBack and exit History. Physical/system back stays unwired
  // to this local state (unchanged from today's SessionDetailCard) and
  // always exits History directly, from either screen.
  function handleOuterBack() {
    if (dayDetailFor !== null) {
      setDayDetailFor(null);
    } else {
      onBack();
    }
  }

  function shiftDate(delta: number) {
    setDayDetailFor(prev => {
      if (prev === null) return prev;
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      return next;
    });
  }

  const daySessions = useMemo(
    () => dayDetailFor === null ? [] : sessionsForDay(entries, dayDetailFor).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    [entries, dayDetailFor],
  );

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--ui-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDownCapture={(e) => {
        // Edge swipe to close — only from left 40px, a narrow zone so it
        // doesn't compete with tapping content elsewhere on screen. Gated
        // the same as the outer header's back button (handleOuterBack).
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
          handleOuterBack();
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
        borderBottom: '1px solid var(--ui-border)',
      }}>
        <button
          onClick={handleOuterBack}
          style={{ ...backButtonStyle(13), padding: '6px 0', marginRight: 12, letterSpacing: '0.01em' }}
        >
          ← Back
        </button>
        <h1 style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ui-gold-dim)',
          margin: 0,
        }}>
          Check-in history
        </h1>
        {entries.length > 0 && (
          <button
            onClick={() => downloadDiaryCsv(entries)}
            title="Download all check-ins as a CSV file"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: '1px solid var(--ui-border)',
              borderRadius: 6,
              color: 'var(--ui-gold-dim)',
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Content — week screen, or day-detail nested as a local-state child */}
      <div style={{ flex: 1, overflowY: 'auto', touchAction: 'pan-y' }}>
        <AnimatePresence mode="wait" initial={false}>
          {dayDetailFor === null ? (
            <motion.div key="week" {...screenMotionProps(-12)}>
              <WeekScreen entries={entries} onSelectDay={setDayDetailFor} />
            </motion.div>
          ) : (
            <motion.div key="day" {...screenMotionProps(12)}>
              <DayDetail
                date={dayDetailFor}
                sessions={daySessions}
                onPrev={() => shiftDate(-1)}
                onNext={() => shiftDate(1)}
                onBackToWeek={() => setDayDetailFor(null)}
                onBack={onBack}
                onOpenEntry={setOpenEntry}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      </div>{/* end centered column */}

      {/* Session detail overlay — outside the centered column so it spans full screen.
          Local state layered on top of whichever content (week screen or day-detail)
          is currently rendered; dismissing it lands back on that same content, no
          new wiring needed. */}
      <SessionDetailCard entry={openEntry} onDismiss={() => setOpenEntry(null)} />
    </div>
  );
}

// ─── Week screen ─────────────────────────────────────────────────────────────

interface WeekScreenProps {
  entries: DiaryEntry[];
  onSelectDay: (date: Date) => void;
}

function WeekScreen({ entries, onSelectDay }: WeekScreenProps) {
  const { days, windowEntries, showInvitation, byDay } = useMemo(() => {
    const days = last7Days();
    const windowEntries = entriesInWindow(entries, days);
    // One pass over windowEntries instead of re-scanning the full entries
    // array once per day.
    return {
      days,
      windowEntries,
      showInvitation: !hasSpreadCoverage(windowEntries),
      byDay: groupByDay(windowEntries),
    };
  }, [entries]);

  return (
    <div style={{ padding: '12px 0' }}>
      <WeekChart entries={windowEntries} />
      {showInvitation && (
        <p style={{ margin: '8px 16px 0', fontSize: 11, color: 'var(--ui-text-3)', fontWeight: 300 }}>
          Patterns get clearer with more check-ins.
        </p>
      )}
      <div style={{ padding: '4px 20px 0' }}>
        {[...days].reverse().map(day => (
          <DailySummaryRow
            key={dateKey(day)}
            date={day}
            sessions={byDay.get(dateKey(day)) ?? []}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Day detail (child view) ─────────────────────────────────────────────────

interface DayDetailProps {
  date: Date;
  sessions: DiaryEntry[];
  onPrev: () => void;
  onNext: () => void;
  onBackToWeek: () => void;
  onBack: () => void;
  onOpenEntry: (entry: DiaryEntry) => void;
}

function DayDetail({ date, sessions, onPrev, onNext, onBackToWeek, onBack, onOpenEntry }: DayDetailProps) {
  const spreadPins = useMemo(() => sessions.flatMap(e => e.pins), [sessions]);

  return (
    <div>
      {/* In-app back control — returns to the week screen. Distinct from the
          outer header's "← Back", which exits History once this is already null. */}
      <button
        onClick={onBackToWeek}
        style={{ ...backButtonStyle(11), fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 20px 0' }}
      >
        ← Week
      </button>

      <DayTabHeader date={date} onPrev={onPrev} onNext={onNext} />

      <DayChart sessions={sessions} onDotTap={onOpenEntry} />

      {sessions.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 12px' }}>
          <MiniCircumplex pins={spreadPins} size={90} showAxes />
        </div>
      )}

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
            <p style={{ fontSize: 15, color: 'var(--ui-text-3)', margin: 0, fontWeight: 300 }}>
              No check-ins on this day.
            </p>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid var(--ui-border)',
                borderRadius: 6,
                color: 'var(--ui-gold)',
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
