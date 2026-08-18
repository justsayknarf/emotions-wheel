import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { emotions } from './data/emotions';
import { nearestTagIds } from './data/regions';
import { adjustPin, withOrigin } from './data/pins';
import { derivePreviousCheckIn, resolveActiveSelection } from './data/checkIn';
import { useRevealTuning } from './config/revealTuning';
import { EmotionField } from './components/EmotionField/EmotionField';
import { EmotionDrawer, RAIL_WIDTH } from './components/EmotionPreview/EmotionDrawer';
import { DefinitionCardSequence } from './components/DefinitionCard/DefinitionCardSequence';
import { SessionComplete } from './components/SessionComplete';
import { DiaryHistory } from './components/DiaryHistory/DiaryHistory';
import { MirrorCard, PEEK_BAR_HEIGHT, PEEK_SAFE_PAD } from './components/EmotionMirror/MirrorCard';
import { FirstRunDemo } from './components/EmotionMirror/FirstRunDemo';
import { WelcomeOverlay } from './components/Welcome/WelcomeOverlay';
import { nextCue } from './data/groundingCues';
import { ConstellationReplay } from './components/Constellation/ConstellationReplay';
import { Tether } from './components/EmotionField/Tether';
import { useDiary } from './hooks/useDiary';
import { useSidePanelLayout } from './hooks/useSidePanelLayout';
import type { AppView, DiaryEntry, PinEntry } from './types';

const ONBOARDED_KEY = 'emotion-selector-onboarded';

// Grounding welcome message: how long the cue holds before it dissolves on its
// own, and the two exit speeds — a slow calm fade when it auto-dissolves, snappy
// when a touch skips it so a quick check-in never feels held up. This is the
// message only; the axis pulse runs on its own separate lifecycle.
const WELCOME_HOLD_MS = 4000;
const WELCOME_EXIT_CALM = 2.2;
const WELCOME_EXIT_SNAP = 0.35;

// Shared style for the field-level header pills (history, replay). Each button
// adds its own edge anchor (left / right).
const HEADER_PILL: CSSProperties = {
  position: 'absolute',
  top: 20,
  background: 'rgba(22, 24, 32, 0.8)',
  border: '1px solid var(--oura-border)',
  borderRadius: 8,
  padding: '7px 13px',
  color: 'var(--oura-text-2)',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  zIndex: 20,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

function useOnboarding() {
  const [hasInteracted, setHasInteracted] = useState(
    () => localStorage.getItem(ONBOARDED_KEY) === 'true',
  );
  const [showHint, setShowHint] = useState(
    () => localStorage.getItem(ONBOARDED_KEY) !== 'true',
  );

  const markInteracted = useCallback(() => {
    if (!hasInteracted) {
      localStorage.setItem(ONBOARDED_KEY, 'true');
      setHasInteracted(true);
      setShowHint(false);
    }
  }, [hasInteracted]);

  return { showHint, hasInteracted, markInteracted };
}

export default function App() {
  const [view, setView] = useState<AppView>('field');
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [lastEntry, setLastEntry] = useState<DiaryEntry | null>(null);
  const sessionStartRef = useRef<number>(0);
  const fieldPlaneRef = useRef<HTMLDivElement>(null);
  const railScrollRef = useRef<HTMLDivElement>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  // The live coordinate while a card slider is dragged — drives the field's ghost
  // preview + travel line. Never persisted; cleared on release (handleAdjustPin).
  const [adjustDraft, setAdjustDraft] = useState<{ x: number; y: number } | null>(null);
  const [enteringPinId, setEnteringPinId] = useState<string | null>(null);
  // Mobile returning-mirror tray: collapsed by default so the field stays
  // pinnable on load; the peek handle expands it.
  const [mirrorExpanded, setMirrorExpanded] = useState(false);
  // Bumped only on a pin drop so the tether re-runs its draw-in; plain card
  // clicks change the pin without a key change, so they reposition instantly.
  const [tetherKey, setTetherKey] = useState(0);

  // Grounding welcome: a cue shown at the start of each check-in. `nonce` lets
  // the auto-dissolve timer restart when a new check-in re-opens the welcome
  // even if it was already showing. `fast` selects the snappy exit on skip.
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeCue, setWelcomeCue] = useState(() => nextCue().cue);
  const [welcomeFast, setWelcomeFast] = useState(false);
  const [welcomeNonce, setWelcomeNonce] = useState(0);

  // The axis pulse is a separate lifecycle from the welcome message: it begins
  // at the same moment but holds the axis emphasis until its own sequence (the
  // two axes, one after the other) has finished, then releases independently.
  const [axisPulseOn, setAxisPulseOn] = useState(true);
  const [axisPulseNonce, setAxisPulseNonce] = useState(0);

  const { entries, record } = useDiary();
  const { showHint, hasInteracted, markInteracted } = useOnboarding();
  const sideBySide = useSidePanelLayout();
  const tuning = useRevealTuning();

  // Seed the session clock on mount (kept out of render to stay pure); each new
  // session/interaction resets it in its own handler.
  useEffect(() => {
    sessionStartRef.current = Date.now();
  }, []);

  // Tear down the welcome message. `fast` picks the snappy exit (a touch skipped
  // it); the slow calm exit is the default (auto-dissolve). Harmless if gone.
  const dismissWelcome = useCallback((fast: boolean) => {
    setWelcomeFast(fast);
    setShowWelcome(false);
  }, []);

  // Release the axis emphasis; the axes then fade out on their own (axisFade).
  const endAxisPulse = useCallback(() => setAxisPulseOn(false), []);

  // Begin a check-in intro: the grounding cue and the axis pulse start together
  // (fresh cue, both re-armed via their nonces) but dissolve independently.
  const beginIntro = useCallback(() => {
    setWelcomeCue(nextCue().cue);
    setWelcomeFast(false);
    setShowWelcome(true);
    setWelcomeNonce((n) => n + 1);
    setAxisPulseOn(true);
    setAxisPulseNonce((n) => n + 1);
  }, []);

  // Welcome message auto-dissolves on its own hold — independent of the axes.
  useEffect(() => {
    if (!showWelcome) return;
    const t = window.setTimeout(() => dismissWelcome(false), WELCOME_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [showWelcome, welcomeNonce, dismissWelcome]);

  // Axis pulse holds emphasis until its full sequence (vertical, then horizontal
  // after the stagger) has run plus a short settle, then releases — separate
  // from the welcome message, and re-derived as the pulse knobs are tuned.
  useEffect(() => {
    if (!axisPulseOn) return;
    const span = tuning.axisPulseStrength > 0
      ? (tuning.axisPulseDelay + tuning.axisPulseStagger + tuning.axisPulseDuration + 0.6) * 1000
      : WELCOME_HOLD_MS;
    const t = window.setTimeout(() => setAxisPulseOn(false), span);
    return () => window.clearTimeout(t);
  }, [axisPulseOn, axisPulseNonce, tuning.axisPulseStrength, tuning.axisPulseDelay, tuning.axisPulseStagger, tuning.axisPulseDuration]);

  // On desktop the field occupies a left plane and the tray a right rail;
  // keep the two flush by sizing the field to the remaining width.
  const fieldWidth = sideBySide ? `calc(100% - ${RAIL_WIDTH})` : '100%';
  const fieldCenterLeft = sideBySide ? `calc((100% - ${RAIL_WIDTH}) / 2)` : '50%';

  // Empty-state surface selection (all within the 'field' view):
  //   history + no pins  → returning mirror (rail card + ghost pin)
  //   no history + fresh → first-run gesture demo
  //   pins present       → active drawer (existing path)
  const hasHistory = entries.length > 0;
  // The previous check-in: the most recent diary entry, derived at render
  // rather than stored, so recording (which clears the draft below) turns the
  // just-recorded entry into this without a second stored copy. `draftId` is
  // always null until U7 adds reopen (a draft carrying a recorded entry's id
  // while it's edited) — there is no carried-id concept in the draft yet, so
  // this excludes nothing beyond naturally resolving to the single most
  // recent entry.
  const draftId: string | null = null;
  const previousCheckIn = derivePreviousCheckIn(entries, draftId);
  // lastCoord now reads through previousCheckIn rather than indexing entries
  // directly, so the ghost pin below tracks the same derivation U6/U8 will use
  // for the full previous-check-in card — one source, not two ways to find
  // "the last entry". U4 generalizes this single coordinate into the previous
  // check-in's full pin set; not this unit's scope.
  const lastCoord = previousCheckIn?.pins.at(-1) ?? null;
  const showMirror = view === 'field' && pins.length === 0 && hasHistory;
  const showDemo = view === 'field' && pins.length === 0 && !hasHistory && !hasInteracted;

  // On mobile, when the returning mirror is docked, end the field at the top of
  // the collapsed peek so the peek never overlaps the field. (On desktop the tray
  // is a side rail, already handled by fieldWidth.) The field re-layouts into the
  // shorter area, so no words or pins hide behind the peek.
  const fieldBottom = !sideBySide && showMirror
    ? `calc(${PEEK_BAR_HEIGHT}px + ${PEEK_SAFE_PAD})`
    : 0;

  // Every time the mirror re-appears (fresh load, or returning to the field from
  // history with a previously-expanded tray) start it collapsed, so an expanded
  // tray never carries over and re-covers the field on a new landing. Done as a
  // render-phase adjustment (React's store-previous pattern) rather than an
  // effect, so it settles before paint and never flashes expanded.
  const [mirrorWasShown, setMirrorWasShown] = useState(false);
  if (showMirror !== mirrorWasShown) {
    setMirrorWasShown(showMirror);
    if (showMirror && mirrorExpanded) setMirrorExpanded(false);
  }
  // Resolve the active check-in and its selected pin together, at render,
  // rather than storing "which check-in is active" as a second piece of
  // state — which check-in owns the resolved pin is derivable from the pin id
  // alone (pin ids are globally unique), so this stays one resolved value
  // rather than two that could drift apart. Falls back to the newest pin
  // within the active check-in when the selected id was removed or never set
  // (see resolveActiveSelection for the full cascade) — so the tether never
  // dangles and no effect is needed to reconcile state.
  const { activeCheckIn, pin: selectedPin } = resolveActiveSelection(pins, previousCheckIn, selectedPinId);
  // Nothing in the UI can visibly reach activeCheckIn === 'previous' yet — no
  // card or field pin exists for the previous check-in until U4 (field pins)
  // and U6 (cards) land. Kept resolved here (not dropped) so those units read
  // it rather than re-deriving it; `void` only silences noUnusedLocals until
  // they do.
  void activeCheckIn;
  const effectiveSelectedPinId = selectedPin?.id ?? null;

  // The highlighted emotions are derived from the *selected* pin, not stored on
  // release — so they track whichever card is active (fresh drop or reselected)
  // and reset to nothing when the last pin is removed. This is the single source
  // of truth behind the field's lit words, the fan, and the card's tag pills;
  // it unifies with the pin emphasis (both key off the selected pin).
  const highlightedIds = useMemo(
    () =>
      selectedPin
        ? new Set(nearestTagIds(selectedPin.x, selectedPin.y, emotions, tuning.tagCount))
        : new Set<string>(),
    [selectedPin, tuning.tagCount],
  );

  const handlePinRelease = useCallback((entry: PinEntry) => {
    // Stamp the drop coordinate as the pin's origin (kept for the field anchor +
    // history); x/y stays authoritative and is what later adjustments move.
    setPins((prev) => [...prev, withOrigin(entry)]);
    setSelectedPinId(entry.id);
    setEnteringPinId(entry.id);
    setTetherKey((k) => k + 1);
    // The new card is prepended at the top — scroll the rail up so it's in view.
    requestAnimationFrame(() => {
      railScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // Clear the entering flag once the card has settled, letting its selected
    // highlight ease in as the tether finishes drawing.
    window.setTimeout(() => {
      setEnteringPinId((cur) => (cur === entry.id ? null : cur));
    }, 620);
  }, []);

  // A release on the field matched an existing pin (EmotionField's hit-test)
  // rather than minting a new one — just select it. resolveActiveSelection
  // derives activeCheckIn from the id on its own (R15): the id belongs to a
  // draft pin, the only kind reachable on the field before U4 lands recorded
  // pins there too, so no check-in-activation logic belongs here.
  const handlePinSelect = useCallback((pinId: string) => {
    setSelectedPinId(pinId);
  }, []);

  const handleRecognize = useCallback((emotionId: string) => {
    setPins((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.recognizedWords.includes(emotionId)) return prev;
      const updated = { ...last, recognizedWords: [...last.recognizedWords, emotionId] };
      return [...prev.slice(0, -1), updated];
    });
  }, []);

  const handleDerecognize = useCallback((emotionId: string) => {
    setPins((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const updated = { ...last, recognizedWords: last.recognizedWords.filter((id) => id !== emotionId) };
      return [...prev.slice(0, -1), updated];
    });
  }, []);

  const handlePinRemove = useCallback((pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
  }, []);

  // Commit an adjusted coordinate (slider released): move the pin and recompute
  // its description in place. regionDescription is a stored snapshot, so it must
  // be refreshed here — highlightedIds re-derives on its own from the new x/y.
  // origin and recognizedWords are deliberately preserved.
  const handleAdjustPin = useCallback((pinId: string, x: number, y: number) => {
    setPins((prev) => prev.map((p) => (p.id === pinId ? adjustPin(p, x, y) : p)));
    setAdjustDraft(null);
  }, []);

  // The live draft coordinate during a slider drag (field preview only); null ends it.
  const handleAdjustDraft = useCallback((coord: { x: number; y: number } | null) => {
    setAdjustDraft(coord);
  }, []);

  const handleRecord = useCallback(() => {
    const entry = record(pins, sessionStartRef.current);
    // Clear the draft so the just-recorded entry becomes the previous
    // check-in through derivePreviousCheckIn (above) rather than through a
    // second stored copy — this is what keeps a second handleRecord call from
    // ever producing a duplicate entry (R20): with the draft empty, there is
    // nothing left to record. Selection is part of the draft being cleared,
    // so it resets too rather than pointing at a pin that no longer exists
    // in it.
    setPins([]);
    setSelectedPinId(null);
    setLastEntry(entry);
    setView('complete');
  }, [pins, record]);

  const handleDone = useCallback(() => {
    if (pins.length > 0) handleRecord();
  }, [pins, handleRecord]);

  const handleNewSession = useCallback(() => {
    // Resets the draft, selection, and view. It does not touch the previous
    // check-in — that's derived from storage (derivePreviousCheckIn above),
    // not stored here, so it survives this reset and a reload alike.
    setPins([]);
    setSelectedPinId(null);
    setLastEntry(null);
    sessionStartRef.current = Date.now();
    setView('field');
    beginIntro();
  }, [beginIntro]);

  const handleFirstInteraction = useCallback(() => {
    markInteracted();
    sessionStartRef.current = Date.now();
  }, [markInteracted]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--oura-bg)' }}
      onPointerDownCapture={() => {
        // Any touch in the field view skips the welcome (snappy exit); the
        // overlay is pointerEvents:none, so the touch still reaches the field.
        // A touch begins the check-in — end both the message and the axis pulse.
        if (view === 'field' && (showWelcome || axisPulseOn)) {
          if (showWelcome) dismissWelcome(true);
          endAxisPulse();
        }
      }}
    >
      {/* Quiet rail backdrop — present on desktop so the right region reads as
          an intentional plane even before a pin is placed */}
      {sideBySide && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: RAIL_WIDTH,
            borderLeft: '1px solid var(--oura-border)',
            background: 'linear-gradient(180deg, #0A0B0F, #0C0D12)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* EmotionField always mounted — single instance, no gesture state issues.
          Sized to the left plane on desktop; full-bleed on mobile. */}
      <div
        ref={fieldPlaneRef}
        style={{ position: 'absolute', top: 0, bottom: fieldBottom, left: 0, width: fieldWidth, zIndex: 2 }}
        onPointerDownCapture={(e) => {
          // While the mirror tray is expanded, a press on the field dismisses it
          // rather than dropping a pin: consume the event (capture-phase stop) so
          // it never reaches EmotionField's synthetic pointer handlers, so no
          // gesture starts and no pin is created. Inert while collapsed.
          if (mirrorExpanded) {
            setMirrorExpanded(false);
            e.stopPropagation();
          }
        }}
      >
        <EmotionField
          pins={pins}
          highlightedIds={highlightedIds}
          onPinRelease={handlePinRelease}
          onPinSelect={handlePinSelect}
          onFirstInteraction={handleFirstInteraction}
          hasInteracted={hasInteracted}
          axisEmphasis={showDemo || axisPulseOn}
          ghostPin={showMirror && lastCoord ? { x: lastCoord.x, y: lastCoord.y } : null}
          emphasizedPinId={effectiveSelectedPinId}
          adjustDraft={adjustDraft}
        />
      </div>

      {/* Field-only chrome: welcome + hint + drawer + history button */}
      {view === 'field' && (
        <>
          {/* Grounding welcome — layered above the first-run hint/demo (its own
              zIndex) so on first run it reads as welcome → demo → field. */}
          <AnimatePresence>
            {showWelcome && (
              <WelcomeOverlay
                key="welcome"
                cue={welcomeCue}
                fieldCenterLeft={fieldCenterLeft}
                exitDuration={welcomeFast ? WELCOME_EXIT_SNAP : WELCOME_EXIT_CALM}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showHint && (
              <div
                key="hint"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: fieldCenterLeft,
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 30,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: 0.4, duration: 0.7, ease: 'easeOut' }}
                  style={{
                    background: 'rgba(13, 15, 20, 0.82)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--oura-border)',
                    borderRadius: 10,
                    padding: '16px 28px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <p style={{ margin: '0 0 5px', fontSize: 18, fontWeight: 300, color: 'var(--oura-text-1)', letterSpacing: '-0.01em' }}>
                    How are you feeling?
                  </p>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: 'var(--oura-text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Touch anywhere to explore
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showMirror && (
              <MirrorCard
                entry={entries[entries.length - 1]}
                entries={entries}
                variant={sideBySide ? 'rail' : 'sheet'}
                expanded={mirrorExpanded}
                onToggle={() => setMirrorExpanded((v) => !v)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDemo && (
              <FirstRunDemo fieldWidth={fieldWidth} variant={sideBySide ? 'rail' : 'sheet'} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {pins.length > 0 && (
              <EmotionDrawer
                pins={pins}
                variant={sideBySide ? 'rail' : 'sheet'}
                onRecognize={handleRecognize}
                onDerecognize={handleDerecognize}
                onPinRemove={handlePinRemove}
                onAdjust={handleAdjustPin}
                onAdjustDraft={handleAdjustDraft}
                dissolve={{ fadeOut: tuning.captionFadeOut, fadeIn: tuning.captionFadeIn, hold: tuning.captionHold }}
                onDone={handleDone}
                onClear={() => { setPins([]); }}
                selectedPinId={effectiveSelectedPinId}
                onSelectPin={setSelectedPinId}
                enteringPinId={enteringPinId}
                scrollRef={railScrollRef}
              />
            )}
          </AnimatePresence>

          {/* Pin-to-card thread — desktop only, follows the selected card */}
          {sideBySide && selectedPin && (
            <Tether
              key={tetherKey}
              pin={selectedPin}
              fieldPlaneRef={fieldPlaneRef}
              railRef={railScrollRef}
              selectedPinId={effectiveSelectedPinId}
            />
          )}

          {entries.length > 0 && (
            <button
              onClick={() => setView('history')}
              style={{ ...HEADER_PILL, right: sideBySide ? `calc(${RAIL_WIDTH} + 20px)` : 20 }}
            >
              history
            </button>
          )}

          {showMirror && (
            <button
              onClick={() => setView('constellation')}
              style={{ ...HEADER_PILL, left: 20 }}
            >
              ✦ replay
            </button>
          )}
        </>
      )}

      {/* Overlays rendered on top of the always-visible field */}
      <AnimatePresence mode="wait">
        {view === 'cards' && (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          >
            <DefinitionCardSequence
              selectedEmotions={[]}
              onRecord={handleRecord}
            />
          </motion.div>
        )}

        {view === 'complete' && lastEntry && (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          >
            <SessionComplete
              entry={lastEntry}
              onNewSession={handleNewSession}
              onViewHistory={() => setView('history')}
            />
          </motion.div>
        )}

        {view === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          >
            <DiaryHistory
              entries={entries}
              onBack={() => setView('field')}
            />
          </motion.div>
        )}

        {view === 'constellation' && (
          <motion.div
            key="constellation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}
          >
            <ConstellationReplay
              entries={entries}
              onDismiss={() => setView('field')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
