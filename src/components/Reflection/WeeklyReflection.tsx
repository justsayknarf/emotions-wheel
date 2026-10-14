import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { DrawnConstellation } from '../Constellation/DrawnConstellation';
import { SkyReplay } from '../Constellation/SkyReplay';
import { useRevealTuning } from '../../config/revealTuning';
import { useSidePanelLayout } from '../../hooks/useSidePanelLayout';
import { reflectionWindow, pickMoments, momentPoint, weekRangeLabel, stopHeading, type TourCursor } from '../../data/reflection';
import { momentPrompt } from '../../data/reflectionPrompts';
import { atTimeNote, walkNote } from '../../data/journal';
import { markJournalNoticeSeen } from '../../store/reflections';
import { dateKey } from '../../utils/diaryAggregation';
import { formatDate } from '../../utils/formatDate';
import { OpeningCard, ReplayingCard, MomentCard, ClosingCard, EmptyWeekCard } from './ReflectionCards';
import { WeekStrip } from './WeekStrip';
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
  /** Record the reflection; false when it couldn't be saved. */
  onComplete: (reflection: Reflection) => boolean;
  onLater: () => void;
  onSkipWeek: () => void;
  onClose: () => void;
}

// The replay opens on a title over the whole week, faint, for this long. The
// tour starts a little before it ends, so the gaze glides in to the first
// check-in as the title fades.
const TITLE_MS = 1800;
const OPENING_HOLD_MS = 1300;

// Text over the sky stays readable against the aurora and the stars.
const SKY_TEXT_SHADOW = '0 2px 14px rgb(var(--ui-bg-rgb) / 0.95)';

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
  const reducedMotion = !!useReducedMotion();

  // Frozen when the walk opens, so a check-in saved meanwhile (another tab)
  // can't reshuffle the moments under the user.
  const [walk] = useState(() => {
    const startedAt = new Date();
    const week = reflectionWindow(entries, startedAt);
    return {
      id: uuidv4(),
      startedAt,
      week,
      // The check-ins the replay draws (each has a pin), in its order.
      placed: week.filter((e) => momentPoint(e) !== null),
      moments: pickMoments(week),
      seed: Math.floor(startedAt.getTime() / 1000),
    };
  });

  const [phase, setPhase] = useState<Phase>(showOpening ? 'opening' : 'replaying');

  // Every way out (Done, Later, Skip this week, Close, Escape) runs at most
  // once. The view fades out over a few hundred ms after the first, and a
  // second press in that window would record the reflection twice and step
  // history back twice, out of the app.
  // A handler that returns false didn't leave (its save failed), so the
  // latch opens again.
  const leaving = useRef(false);
  const once = <A extends unknown[]>(fn: (...args: A) => boolean | void) => (...args: A) => {
    if (leaving.current) return;
    leaving.current = true;
    if (fn(...args) === false) leaving.current = false;
  };
  const close = once(onClose);
  const [index, setIndex] = useState(0);
  const [jump, setJump] = useState(false);
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const [doneFailed, setDoneFailed] = useState(false);
  const [openLine, setOpenLine] = useState('');
  const [weekName, setWeekName] = useState('');

  // The replay screen: a title first, then the day and time of each check-in
  // as it arrives, and Next to move on without waiting for the tour.
  const [titleOn, setTitleOn] = useState(() => !showOpening && !reducedMotion);
  const [stop, setStop] = useState(-1);
  const [goTo, setGoTo] = useState<{ stop: number } | null>(null);
  // The furthest check-in asked for, so two quick Nexts move two check-ins.
  const aimed = useRef(-1);
  const tourCursor = useRef<TourCursor | null>(null);
  const onStop = useCallback((i: number) => {
    setStop(i);
    setTitleOn(false);
  }, []);
  useEffect(() => {
    if (!titleOn) return;
    const timer = window.setTimeout(() => setTitleOn(false), TITLE_MS);
    return () => window.clearTimeout(timer);
  }, [titleOn]);

  // Escape leaves the walk, from any card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.repeat && !e.isComposing) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const { moments, placed } = walk;

  // Next: on to the check-in after the one in view (or after one already on
  // its way); past the last, to the moments.
  const next = () => {
    setTitleOn(false);
    const target = Math.max(stop, aimed.current) + 1;
    if (target >= placed.length) {
      setJump(true);
      return;
    }
    aimed.current = target;
    setGoTo({ stop: target });
  };
  const pick = (i: number) => {
    setTitleOn(false);
    aimed.current = i;
    setGoTo({ stop: i });
  };

  // During the replay, → or Space moves to the next check-in.
  useEffect(() => {
    if (phase !== 'replaying') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== ' ') return;
      if (e.target instanceof Element && e.target.closest('button, input, textarea')) return;
      e.preventDefault();
      next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const live = (id: string) => entries.find((e) => e.id === id) ?? null;
  const savedNote = (i: number) => {
    const e = live(moments[i].id);
    return e ? walkNote(e, walk.id)?.text ?? '' : '';
  };

  const goToMoment = (i: number) => {
    setIndex(i);
    setDraft(savedNote(i));
    setFailed(false);
    setDoneFailed(false);
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

  // A save that fails keeps the walk open on the closing card, with what was
  // typed, and Done can try again.
  const done = once(() => {
    const name = weekName.trim();
    const line = openLine.trim();
    const saved = onComplete({
      id: walk.id,
      completedAt: new Date().toISOString(),
      windowEndKey: dateKey(walk.startedAt),
      momentEntryIds: moments.map((m) => m.id),
      opened,
      ...(line ? { openLine: line } : {}),
      ...(name ? { weekName: name } : {}),
    });
    setDoneFailed(!saved);
    return saved;
  });

  const current = phase === 'moment' ? moments[index] : null;
  const currentPoint = current ? momentPoint(current) : null;
  const thenNote = current ? atTimeNote(live(current.id) ?? current)?.text ?? null : null;

  let card;
  if (moments.length === 0) {
    card = <EmptyWeekCard onClose={close} />;
  } else if (phase === 'opening') {
    const begin = () => {
      setPhase('replaying');
      setTitleOn(!reducedMotion);
    };
    card = <OpeningCard onBegin={begin} onLater={once(onLater)} onSkipWeek={once(onSkipWeek)} />;
  } else if (phase === 'replaying') {
    card = (
      <ReplayingCard
        stop={stop}
        total={placed.length}
        hint={sideBySide ? 'Tap the sky or press → for the next one.' : 'Tap the sky for the next one.'}
        onNext={next}
        onSkip={() => setJump(true)}
      />
    );
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
        failed={doneFailed}
      />
    );
  }

  const showSky = moments.length > 0 && phase !== 'opening';
  const heading = phase === 'replaying' && stop >= 0 ? stopHeading(placed[stop].timestamp, walk.startedAt) : null;
  const showStrip = sideBySide && showSky && (phase === 'replaying' || phase === 'moment');

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
      {/* The week's sky. Tapping it during the replay moves to the next
          check-in. Isolated so the replay's own layers (SkyReplay's canvas
          sits at z-index 1) stay inside it and can never cover the Close
          button above. */}
      <div
        onClick={phase === 'replaying' ? next : undefined}
        style={{ position: 'relative', isolation: 'isolate', flex: sideBySide ? 1 : '0 0 52%', minHeight: 0 }}
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
            startDelayMs: titleOn ? OPENING_HOLD_MS : undefined,
            preview: true,
            showDayLabels: false,
            goTo,
            onStop,
            cursor: tourCursor,
          };
          return sky ? <SkyReplay {...replay} entries={placed} /> : <DrawnConstellation {...replay} entries={placed} />;
        })()}

        {/* The title: which week this is, over the whole of it, faint. Dates
            and counts are Inter (DESIGN.md, the serif is for feelings). */}
        {phase === 'replaying' && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', opacity: titleOn ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                paddingTop: '16%',
                textAlign: 'center',
                animation: 'reflection-hint-in 0.6s ease both',
              }}
            >
              <span style={{ fontWeight: 300, fontSize: sideBySide ? 26 : 22, letterSpacing: '0.01em', color: 'var(--ui-text-1)', textShadow: SKY_TEXT_SHADOW }}>
                {weekRangeLabel(walk.startedAt)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ui-text-2)', textShadow: SKY_TEXT_SHADOW }}>
                {placed.length === 1 ? '1 check-in, as it happened' : `${placed.length} check-ins, as they happened`}
              </span>
            </div>
          </div>
        )}

        {/* The day and time of the check-in in view. */}
        {heading && (
          <div
            key={stop}
            aria-hidden="true"
            style={{
              position: 'absolute',
              // Below the flat plane's "Positive" axis label.
              top: sky ? 18 : 36,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              animation: 'reflection-hint-in 0.4s ease both',
            }}
          >
            <div style={{ fontWeight: 300, fontSize: sideBySide ? 20 : 17, lineHeight: 1.2, letterSpacing: '0.01em', color: 'var(--ui-text-1)', textShadow: SKY_TEXT_SHADOW }}>
              {heading.day}
            </div>
            <div style={{ marginTop: 3, fontSize: 12, letterSpacing: '0.05em', color: 'var(--ui-text-2)', fontVariantNumeric: 'tabular-nums', textShadow: SKY_TEXT_SHADOW }}>
              {heading.detail}
            </div>
          </div>
        )}

        {showStrip && (
          <WeekStrip
            entries={placed}
            now={walk.startedAt}
            arrived={stop}
            cursor={tourCursor}
            held={phase === 'moment' && current ? placed.findIndex((e) => e.id === current.id) : null}
            onPick={phase === 'replaying' ? pick : null}
          />
        )}
      </div>

      {/* The card: beside the sky on desktop, below it on mobile. */}
      <div
        style={{
          flex: sideBySide ? '0 0 min(400px, 40%)' : 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
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
