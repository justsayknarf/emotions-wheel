import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DrawnConstellation } from '../Constellation/DrawnConstellation';
import { SkyReplay } from '../Constellation/SkyReplay';
import { useRevealTuning } from '../../config/revealTuning';
import { useSidePanelLayout } from '../../hooks/useSidePanelLayout';
import { reflectionWindow, pickMoments, momentPoint } from '../../data/reflection';
import { momentPrompt } from '../../data/reflectionPrompts';
import { atTimeNote, walkNote } from '../../data/journal';
import { markJournalNoticeSeen } from '../../store/reflections';
import { dateKey } from '../../utils/diaryAggregation';
import { formatDate } from '../../utils/formatDate';
import { OpeningCard, ReplayingCard, MomentCard, ClosingCard, EmptyWeekCard } from './ReflectionCards';
import type { DiaryEntry, Reflection } from '../../types';

// The weekly reflection walk (view === 'reflection'). docs/plans/2026-10-09-
// 001-feat-weekly-reflection-journal-plan.md, U4: replay the week, pause on up
// to three contrasting moments with an observer-style prompt and an optional
// note at each, then close with an optional line and a name for the week.
// Leaving at any point records no reflection and asks nothing (R16).

type Phase = 'opening' | 'replaying' | 'moment' | 'closing';

interface Props {
  entries: DiaryEntry[];
  opened: Reflection['opened'];
  /** Start on the opening card (Begin / Later / Skip this week). */
  showOpening: boolean;
  onSetLookingBackNote: (entryId: string, walkId: string, text: string) => boolean;
  onComplete: (reflection: Reflection) => void;
  onLater: () => void;
  onSkipWeek: () => void;
  onClose: () => void;
}

const AXIS_LABEL: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  fontSize: 9,
  fontWeight: 500,
  color: 'rgb(var(--ui-text-rgb) / 0.35)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

export function WeeklyReflection({ entries, opened, showOpening, onSetLookingBackNote, onComplete, onLater, onSkipWeek, onClose }: Props) {
  const sideBySide = useSidePanelLayout();
  // The same replay History's constellation replay uses: the night sky when
  // the sky field is on, the flat plane otherwise.
  const sky = useRevealTuning().skyField;

  // Frozen when the walk opens, so a check-in saved meanwhile (another tab)
  // can't reshuffle the moments under the user.
  const [walk] = useState(() => {
    const startedAt = new Date();
    const week = reflectionWindow(entries, startedAt);
    return {
      id: uuidv4(),
      startedAt,
      week,
      moments: pickMoments(week),
      seed: Math.floor(startedAt.getTime() / 1000),
    };
  });

  const [phase, setPhase] = useState<Phase>(showOpening ? 'opening' : 'replaying');

  // Every way out (Done, Later, Skip this week, Close, Escape) runs at most
  // once. The view fades out over a few hundred ms after the first, and a
  // second press in that window would record the reflection twice and step
  // history back twice, out of the app.
  const leaving = useRef(false);
  const once = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    if (leaving.current) return;
    leaving.current = true;
    fn(...args);
  };
  const close = once(onClose);
  const [index, setIndex] = useState(0);
  const [jump, setJump] = useState(false);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const [openLine, setOpenLine] = useState('');
  const [weekName, setWeekName] = useState('');

  // Escape leaves the walk, from any card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat && !e.isComposing) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // During the replay, any key skips ahead to the first moment.
  useEffect(() => {
    if (phase !== 'replaying') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Tab') setJump(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const { moments } = walk;
  const live = (id: string) => entries.find((e) => e.id === id) ?? null;
  const savedNote = (i: number) => {
    const e = live(moments[i].id);
    return e ? walkNote(e, walk.id)?.text ?? '' : '';
  };

  const goToMoment = (i: number) => {
    setIndex(i);
    setDraft(savedNote(i));
    setFailed(false);
    setPhase('moment');
  };

  // Commit the current moment's note (KTD10): writes only when it changed,
  // so moving past an untouched moment writes nothing. Returns false when a
  // write failed, keeping the user on the card to see why.
  const commit = (): boolean => {
    if (draft.trim() === savedNote(index).trim()) return true;
    const ok = onSetLookingBackNote(moments[index].id, walk.id, draft);
    setFailed(!ok);
    if (ok && draft.trim()) markJournalNoticeSeen();
    return ok;
  };

  const forward = () => {
    if (!commit()) return;
    if (index < moments.length - 1) goToMoment(index + 1);
    else setPhase('closing');
  };
  const back = () => {
    if (!commit()) return;
    goToMoment(index - 1);
  };

  const done = once(() => {
    const name = weekName.trim();
    const line = openLine.trim();
    onComplete({
      id: walk.id,
      completedAt: new Date().toISOString(),
      windowEndKey: dateKey(walk.startedAt),
      momentEntryIds: moments.map((m) => m.id),
      opened,
      ...(line ? { openLine: line } : {}),
      ...(name ? { weekName: name } : {}),
    });
  });

  const current = phase === 'moment' ? moments[index] : null;
  const currentPoint = current ? momentPoint(current) : null;
  const thenNote = current ? atTimeNote(live(current.id) ?? current)?.text ?? null : null;

  let card;
  if (moments.length === 0) {
    card = <EmptyWeekCard onClose={close} />;
  } else if (phase === 'opening') {
    card = <OpeningCard onBegin={() => setPhase('replaying')} onLater={once(onLater)} onSkipWeek={once(onSkipWeek)} />;
  } else if (phase === 'replaying') {
    card = <ReplayingCard onSkip={() => setJump(true)} />;
  } else if (phase === 'moment' && current && currentPoint) {
    card = (
      <MomentCard
        index={index}
        total={moments.length}
        when={formatDate(current.timestamp)}
        prompt={momentPrompt(currentPoint, current.timestamp, index, walk.seed, walk.startedAt)}
        thenNote={thenNote}
        draft={draft}
        onDraft={setDraft}
        onBack={index > 0 ? back : null}
        onForward={forward}
        failed={failed}
      />
    );
  } else {
    card = (
      <ClosingCard
        openLine={openLine}
        onOpenLine={setOpenLine}
        weekName={weekName}
        onWeekName={setWeekName}
        onBack={() => goToMoment(moments.length - 1)}
        onDone={done}
      />
    );
  }

  const showSky = moments.length > 0 && phase !== 'opening';

  return (
    <div
      role="dialog"
      aria-label="Weekly reflection"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--ui-bg)',
        display: 'flex',
        flexDirection: sideBySide ? 'row' : 'column',
        overflow: 'hidden',
      }}
    >
      {/* The week's sky. Tapping it during the replay skips ahead. */}
      <div
        onClick={phase === 'replaying' ? () => setJump(true) : undefined}
        style={{ position: 'relative', flex: sideBySide ? 1 : '0 0 52%', minHeight: 0 }}
      >
        {/* Axis names fit the flat plane only: in the sky the gaze moves. */}
        {!sky && (
          <>
          <div style={{ ...AXIS_LABEL, top: 16, left: '50%', transform: 'translateX(-50%)' }}>Positive</div>
          <div style={{ ...AXIS_LABEL, bottom: 12, left: '50%', transform: 'translateX(-50%)' }}>Negative</div>
          <div style={{ ...AXIS_LABEL, left: 16, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>Calm</div>
          <div style={{ ...AXIS_LABEL, right: 16, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }}>Activated</div>
          </>
        )}
        {showSky && (() => {
          const replay = {
            entries: walk.week,
            highlightEntryId: current?.id ?? null,
            showControls: false,
            jumpToEnd: jump,
            // Only the first ending opens moment one: a timeline rebuilt later
            // (a reduced-motion flip) must not pull the user back mid-walk.
            onReplayEnd: () => { if (phase === 'replaying') goToMoment(0); },
          };
          return sky ? <SkyReplay {...replay} /> : <DrawnConstellation {...replay} />;
        })()}
      </div>

      {/* The card: beside the sky on desktop, below it on mobile. */}
      <div
        style={{
          flex: sideBySide ? '0 0 min(400px, 40%)' : 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: sideBySide ? '72px 32px 32px' : '20px 20px 28px',
          borderLeft: sideBySide ? '1px solid var(--ui-border)' : 'none',
          borderTop: sideBySide ? 'none' : '1px solid var(--ui-border)',
          background: 'rgb(var(--ui-surface-rgb) / 0.55)',
        }}
      >
        {card}
      </div>

      <button
        type="button"
        onClick={close}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          minHeight: 36,
          background: 'rgb(var(--ui-surface-rgb) / 0.8)',
          border: '1px solid var(--ui-border)',
          borderRadius: 8,
          padding: '7px 13px',
          color: 'var(--ui-text-2)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          letterSpacing: '0.06em',
        }}
      >
        Close
      </button>
    </div>
  );
}
