import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AnimatePresence, motion } from 'framer-motion';
import { emotions } from './data/emotions';
import { nearestTagIds, getRegionDescription } from './data/regions';
import { adjustPin, withOrigin } from './data/pins';
import { derivePreviousCheckIn, resolveActiveSelection } from './data/checkIn';
import { relativeDayLabel, departureAnchor, isDepartureEligible } from './data/departure';
import { useRevealTuning } from './config/revealTuning';
import { EmotionField } from './components/EmotionField/EmotionField';
import { EmotionDrawer, RAIL_WIDTH, PEEK_BAR_HEIGHT, PEEK_SAFE_PAD } from './components/EmotionPreview/EmotionDrawer';
import { DefinitionCardSequence } from './components/DefinitionCard/DefinitionCardSequence';
import { SessionComplete } from './components/SessionComplete';
import { DiaryHistory } from './components/DiaryHistory/DiaryHistory';
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
  border: '1px solid var(--ui-border)',
  borderRadius: 8,
  padding: '7px 13px',
  color: 'var(--ui-text-2)',
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
  // preview + travel line, and (via pinId) which card's chrome to shrink around
  // (EmotionDrawer's draggingPinId derivation below). Never persisted; cleared
  // on release or cancel (handleAdjustPin / CoordinateCard's cancelAxis).
  const [adjustDraft, setAdjustDraft] = useState<{ pinId: string; x: number; y: number } | null>(null);
  // Derived at render, not a separate state — the single source for "which
  // card's slider is currently being dragged," read by EmotionDrawer to hide
  // sibling chrome (U5) and by the field-press gesture (U3) to skip peeking
  // while a drag is already in progress (R15).
  const draggingPinId = adjustDraft?.pinId ?? null;
  const [enteringPinId, setEnteringPinId] = useState<string | null>(null);
  // Mobile drawer tray, peeked over the previous check-in: collapsed by
  // default so the field stays pinnable on load; the peek handle expands it
  // (EmotionDrawer's sheet variant, since U8 merged the returning mirror into
  // it).
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

  const { entries, record, updateEntry } = useDiary();
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
  //   history + no pins  → previous check-in's own surface docks peeked
  //   no history + fresh → first-run gesture demo
  //   pins present       → active drawer (existing path)
  const hasHistory = entries.length > 0;
  // The previous check-in: the most recent diary entry, derived at render
  // rather than stored, so recording (which clears the draft below) turns the
  // just-recorded entry into this without a second stored copy. `draftId` is
  // the id of the recorded entry the draft currently carries, if it was
  // opened via reopen (U7) rather than started fresh — real state now, so
  // reopening a previous check-in excludes it from this derivation for the
  // duration of the edit, as derivePreviousCheckIn was already built (U2) to
  // do the instant a non-null id is passed.
  const [draftId, setDraftId] = useState<string | null>(null);
  // Which of a reopened check-in's pins are currently expanded/editable —
  // seeded with just the clicked pin (handleReopen) so reopening a
  // multi-pin check-in doesn't drop the user into every card's edit state
  // at once. A sibling can still be brought in individually (handleExpandPin).
  // Only meaningful while draftId is set; reset alongside it.
  const [expandedPinIds, setExpandedPinIds] = useState<Set<string>>(new Set());
  const previousCheckIn = derivePreviousCheckIn(entries, draftId);
  // U4/R5, U3: resolved once here rather than in each consumer, so the
  // field's anchor label and the card's delta sentence (U3) can't drift
  // apart into reporting a different "how long ago" for the same check-in.
  const previousCheckInLabel = previousCheckIn ? relativeDayLabel(previousCheckIn.timestamp, new Date()) : null;
  // U3/R9: the draft card's own anchor tick + delta compare against this
  // same pin — matching departureAnchor's fallback everywhere else already
  // does, so the field ring, the departure card, and the draft card never
  // point at three different "anchors."
  const anchorPin = departureAnchor(previousCheckIn);
  // The most recent entry regardless of any active reopen — unlike
  // previousCheckIn, never excludes the entry currently being edited. Feeds
  // only the drawer's returning-summary (time + rhythm), which should stay
  // visible through an edit so it reads as happening in place, not as a
  // different view replacing it.
  const mostRecentEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  // U8: gated on `previousCheckIn` rather than `hasHistory`. The two coincide
  // whenever nothing is reopened, but diverge while a check-in is (U7) — a
  // reopened entry stays in `entries` but drops out of `previousCheckIn` for
  // the duration of the edit. Gating here on `previousCheckIn` is what keeps
  // this in sync with what's actually shown (the field inset and the replay
  // entry point both read this same value) instead of drifting stale against
  // a reopened check-in. The name
  // `showMirror` predates the U8 merge — its role has shifted from "gate a
  // separate mirror card" to "the tray is in its peek-eligible, nothing-new
  // -to-add state" — kept as-is rather than renamed across every call site
  // for a purely cosmetic reason.
  const showMirror = view === 'field' && pins.length === 0 && previousCheckIn !== null;
  const showDemo = view === 'field' && pins.length === 0 && !hasHistory && !hasInteracted;

  // On mobile, when the tray is peek-eligible, end the field at the top of the
  // collapsed peek so the peek never overlaps the field. (On desktop the tray
  // is a side rail, already handled by fieldWidth.) The field re-layouts into the
  // shorter area, so no words or pins hide behind the peek.
  const fieldBottom = !sideBySide && showMirror
    ? `calc(${PEEK_BAR_HEIGHT}px + ${PEEK_SAFE_PAD})`
    : 0;

  // Every time the tray re-enters its peek-eligible state (fresh load, or
  // returning to the field from history with a previously-expanded tray)
  // start it collapsed, so an expanded tray never carries over and re-covers
  // the field on a new landing. Done as a render-phase adjustment (React's
  // store-previous pattern) rather than an effect, so it settles before paint
  // and never flashes expanded. Kept here (U8) rather than moved into
  // EmotionDrawer, since App.tsx already owns both the `showMirror`-derived
  // boolean this keys on and the `mirrorExpanded` state it resets.
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
  const effectiveSelectedPinId = selectedPin?.id ?? null;
  // The tether draws a line from a field pin to its card — a strong visual
  // claim that "this card is what you're looking at." resolveActiveSelection
  // resolves a pin from the previous check-in via fallback (not an explicit
  // match on selectedPinId) whenever the draft is empty and nothing has been
  // picked — on first load, and again right after recording, discarding, or
  // starting a new session — so the tether would otherwise draw to a card
  // the user hasn't actually selected. Suppressed only for that fallback
  // case; a real tap on a card or a field pin sets selectedPinId, which
  // resolves through the explicit-match branches instead and draws normally.
  const tetherSuppressed = selectedPinId === null && activeCheckIn === 'previous';

  // The highlighted emotions are derived from the *selected* pin, not stored on
  // release — so they track whichever card is active (fresh drop or reselected)
  // and reset to nothing when the last pin is removed. This is the single source
  // of truth behind the field's lit words, the fan, and the card's tag pills;
  // it unifies with the pin emphasis (both key off the selected pin).
  //
  // Also suppressed for the same fallback case as the tether (see
  // tetherSuppressed above): without this, the previous check-in's pin lights
  // up its whole neighborhood of deep words the instant it's on the field —
  // no hover, no dwell, and it never fades as the cursor moves away — because
  // resolveActiveSelection's fallback makes it read as "selected" before the
  // user has done anything. That reads as an oversized, stuck reveal radius
  // rather than the proximity-driven one the rest of the field uses.
  const highlightedIds = useMemo(
    () =>
      selectedPin && !tetherSuppressed
        ? new Set(nearestTagIds(selectedPin.x, selectedPin.y, emotions, tuning.tagCount))
        : new Set<string>(),
    [selectedPin, tetherSuppressed, tuning.tagCount],
  );

  // U6/R6: the departure connector's one-shot trigger + the anchor/new-pin
  // pair it draws between. `play` increments only inside handlePinRelease
  // below — never in handleAdjustPin — so later adjustments of the same
  // pin never re-fire the connector, matching R6/LC5.
  const [departureTracePlay, setDepartureTracePlay] = useState(0);
  const [departureTraceFrom, setDepartureTraceFrom] = useState<{ x: number; y: number } | null>(null);
  const [departureTraceTo, setDepartureTraceTo] = useState<{ x: number; y: number } | null>(null);

  const handlePinRelease = useCallback((entry: PinEntry) => {
    // Reopening is for correcting an existing check-in's pins, not growing
    // it with a new one — a fresh drop here would silently join whichever
    // check-in is currently being edited, appearing as a collapsed sibling
    // that has nothing to do with the correction in progress. Refuse the
    // drop outright rather than accept it into the wrong check-in; nothing
    // reaches `pins` here, so no pin ever appears on the field or the card
    // list for it.
    if (draftId !== null) return;
    // R6: any mint while the landing state applies is a departure from the
    // anchor — both gestures the plan describes (dragging a departure
    // slider via handleDepart below, or pressing the field directly) end
    // up here, so the connector fires for either one rather than only the
    // slider gesture. Checked with the same shared predicate the card uses
    // (isDepartureEligible), against `pins` as it stands *before* this
    // mint — draftId is already known null from the guard above.
    if (isDepartureEligible(false, pins.length, previousCheckIn) && anchorPin) {
      setDepartureTraceFrom({ x: anchorPin.x, y: anchorPin.y });
      setDepartureTraceTo({ x: entry.x, y: entry.y });
      setDepartureTracePlay((p) => p + 1);
    }
    // R5/R11: every new-pin drop re-expands the tray, whether it had been
    // peeked by U3's field-press gesture or by the manual toggle (R1) — a
    // fresh card should always be visible right after it lands. Selecting an
    // existing pin instead (handlePinSelect below) does not do this (R6).
    setMirrorExpanded(true);
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
  }, [draftId, pins.length, previousCheckIn, anchorPin]);

  // U2/R1-R4: the landing card's pre-positioned sliders, released for the
  // first time — mints a brand-new draft pin departing from the previous
  // check-in's anchor. Builds the same shape EmotionField's own field-press
  // drop does (handleRelease there) and hands it to handlePinRelease, which
  // already does everything a fresh pin needs: withOrigin, select, expand
  // the tray, scroll it into view. The anchor itself is never touched —
  // this only ever appends to `pins`.
  const handleDepart = useCallback((x: number, y: number) => {
    // The departure-trace trigger now lives centrally in handlePinRelease
    // (it fires for *either* departure gesture — this slider path or a
    // direct field press — see its own comment), so this stays a thin
    // wrapper building the same shape EmotionField's own field-press drop
    // does (handleRelease there).
    handlePinRelease({
      id: uuidv4(),
      x,
      y,
      recognizedWords: [],
      regionDescription: getRegionDescription(x, y, emotions),
    });
  }, [handlePinRelease]);

  // A release on the field matched an existing pin (EmotionField's hit-test)
  // rather than minting a new one — just select it. resolveActiveSelection
  // derives activeCheckIn from the id on its own (R15): the id belongs to a
  // draft pin, the only kind reachable on the field before U4 lands recorded
  // pins there too, so no check-in-activation logic belongs here.
  const handlePinSelect = useCallback((pinId: string) => {
    setSelectedPinId(pinId);
  }, []);

  // U3: the field's own press-and-drag pin-placement gesture peeks the tray
  // for its duration (R4). `active: true` fires once the gesture crosses the
  // tap/drag movement threshold (R14 — a plain tap never reaches this).
  // Skipped entirely while a slider drag is already in progress (R15) — a
  // second finger on the field must never flip the tray state out from under
  // an in-progress card drag, which is what unmounts it (see U5). `active:
  // false` only fires on a cancelled gesture (useFieldGesture never fires it
  // on an ordinary release — see the hook's own comment); restore to
  // expanded, since nothing committed.
  const handleFieldGestureActiveChange = useCallback((active: boolean) => {
    if (active) {
      // Also skip while a reopen is active (draftId set): the gesture's own
      // drop would be refused anyway (handlePinRelease's own draftId guard,
      // a783e7b), and isPeeked already ignores `expanded` whenever isReopened
      // is true — so collapsing here would be invisible now but could leave
      // mirrorExpanded false, snapping the tray to peeked the moment the
      // reopen ends and isReopened stops overriding it.
      if (draggingPinId !== null || draftId !== null) return;
      setMirrorExpanded(false);
    } else {
      setMirrorExpanded(true);
    }
  }, [draggingPinId, draftId]);

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

  // U5: the card list's scroll position across a drag's shrink/restore. Capture
  // happens synchronously here, before the shrink renders (the list is still
  // full-height at this point) — a ref, not the `wasDragging` derived from
  // `adjustDraft` state, so a burst of same-tick move events can't re-capture
  // mid-drag. Restore happens in the effect below, after React has already
  // re-rendered the full list back in — restoring in this same callback would
  // set scrollTop against the still-shrunk (smaller) content and get clamped.
  const scrollRestoreRef = useRef<number | null>(null);
  const wasDraggingRef = useRef(false);

  // The live draft coordinate during a slider drag (field preview only); null ends it.
  const handleAdjustDraft = useCallback((coord: { pinId: string; x: number; y: number } | null) => {
    if (coord !== null && !wasDraggingRef.current) {
      wasDraggingRef.current = true;
      scrollRestoreRef.current = railScrollRef.current?.scrollTop ?? null;
    } else if (coord === null) {
      wasDraggingRef.current = false;
    }
    setAdjustDraft(coord);
  }, []);

  const prevDraggingPinIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (draggingPinId === null && prevDraggingPinIdRef.current !== null && scrollRestoreRef.current !== null) {
      if (railScrollRef.current) railScrollRef.current.scrollTop = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
    }
    prevDraggingPinIdRef.current = draggingPinId;
  }, [draggingPinId]);

  const handleRecord = useCallback(() => {
    if (draftId) {
      // Saving a reopened check-in (U7/R25) updates its existing record
      // rather than appending a new one. timestamp and sessionDurationMs
      // here are placeholders — updateEntryInList (src/data/checkIn.ts)
      // discards both in favor of the original entry's values, so there is
      // nothing to look up or compute.
      updateEntry({
        id: draftId,
        pins,
        timestamp: new Date().toISOString(),
        sessionDurationMs: 0,
      });
      setPins([]);
      setSelectedPinId(null);
      setDraftId(null);
      setExpandedPinIds(new Set());
      // Deliberately no setLastEntry/setView('complete') here — saving a
      // correction returns to the field with the updated check-in active
      // (R25's "updates its existing record" is not a new completion moment),
      // not the append path's celebration screen.
    } else {
      const entry = record(pins, sessionStartRef.current);
      // Clear the draft so the just-recorded entry becomes the previous
      // check-in through derivePreviousCheckIn (above) rather than through a
      // second stored copy — this is what keeps a second handleRecord call
      // from ever producing a duplicate entry (R20): with the draft empty,
      // there is nothing left to record. Selection is part of the draft
      // being cleared, so it resets too rather than pointing at a pin that no
      // longer exists in it.
      setPins([]);
      setSelectedPinId(null);
      setLastEntry(entry);
      setView('complete');
    }
  }, [pins, record, updateEntry, draftId]);

  const handleDone = useCallback(() => {
    if (pins.length > 0) handleRecord();
  }, [pins, handleRecord]);

  // Reopen a previous check-in: moves its pins into the draft and carries
  // its id, so it becomes an ordinary, fully-adjustable draft — R23 needs
  // nothing further, since draft CoordinateCards already always render
  // sliders unconditionally. The entry itself is untouched in `entries`
  // (R24): nothing here calls updateEntry or mutates the diary — it only
  // appears to move because derivePreviousCheckIn now excludes it via
  // draftId. Only `pinId` (the card that was actually clicked) starts out
  // expanded — its siblings are part of the same draft/save unit but stay
  // collapsed until individually expanded, so reopening a multi-pin
  // check-in doesn't drop every one of its cards into edit mode at once.
  const handleReopen = useCallback((entryId: string, pinId: string) => {
    if (pins.length > 0) return; // defensive — the UI already disables this via reopenDisabled
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    setPins(entry.pins);
    setDraftId(entryId);
    setSelectedPinId(pinId);
    setExpandedPinIds(new Set([pinId]));
  }, [entries, pins]);

  // Bring one more sibling pin into edit mode within an already-active
  // reopen (the check-in is already in the draft — this never starts a new
  // reopen, just widens which of its cards render editable).
  const handleExpandPin = useCallback((pinId: string) => {
    setExpandedPinIds((prev) => (prev.has(pinId) ? prev : new Set(prev).add(pinId)));
    setSelectedPinId(pinId);
  }, []);

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
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--ui-bg)' }}
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
            borderLeft: '1px solid var(--ui-border)',
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
          // While the passive, nothing-to-add mirror is EXPANDED (showMirror:
          // empty draft, previous check-in present — AND mirrorExpanded: it's
          // actually covering the field, not already peeked), a press on the
          // field dismisses it rather than dropping a pin: consume the event
          // (capture-phase stop) so it never reaches EmotionField's synthetic
          // pointer handlers, so no gesture starts and no pin is created.
          // Both conditions are required, not just showMirror — showMirror
          // alone doesn't mean the tray is covering anything right now (it
          // could already be peeked), and firing unconditionally on it eats
          // every field press for any returning user with an empty draft,
          // even with nothing expanded to dismiss. Scoped away from raw
          // mirrorExpanded alone too — once the draft has pins, the tray is
          // commonly expanded by default (R7/R11), and this guard must not
          // also intercept an ordinary pin-drop press; that gesture drives
          // its own peek instead (U3).
          if (showMirror && mirrorExpanded) {
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
          recordedPins={previousCheckIn?.pins ?? []}
          previousCheckInLabel={previousCheckInLabel}
          emphasizedPinId={effectiveSelectedPinId}
          adjustDraft={adjustDraft ? { x: adjustDraft.x, y: adjustDraft.y } : null}
          onGestureActiveChange={handleFieldGestureActiveChange}
          departureTracePlay={departureTracePlay}
          departureTraceFrom={departureTraceFrom}
          departureTraceTo={departureTraceTo}
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
                    border: '1px solid var(--ui-border)',
                    borderRadius: 10,
                    padding: '16px 28px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <p style={{ margin: '0 0 5px', fontSize: 18, fontWeight: 300, color: 'var(--ui-text-1)', letterSpacing: '-0.01em' }}>
                    How are you feeling?
                  </p>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 500, color: 'var(--ui-text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Touch anywhere to explore
                  </p>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showDemo && (
              <FirstRunDemo fieldWidth={fieldWidth} variant={sideBySide ? 'rail' : 'sheet'} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {/* Also mounts while a reopen is active (draftId set) even if the
                draft has been emptied out mid-edit (every pin removed) — an
                empty pins array otherwise matches neither of the first two
                clauses, and previousCheckIn is already null during a reopen
                (the entry is excluded from it while being edited), so
                without this the drawer would vanish entirely with no Discard
                Edit / Update Check-in left to click, leaving a refresh as
                the only way out. */}
            {(pins.length > 0 || previousCheckIn || draftId !== null) && (
              <EmotionDrawer
                pins={pins}
                previousCheckIn={previousCheckIn}
                mostRecentEntry={mostRecentEntry}
                entries={entries}
                variant={sideBySide ? 'rail' : 'sheet'}
                onRecognize={handleRecognize}
                onDerecognize={handleDerecognize}
                onPinRemove={handlePinRemove}
                onAdjust={handleAdjustPin}
                onAdjustDraft={handleAdjustDraft}
                dissolve={{ fadeOut: tuning.captionFadeOut, fadeIn: tuning.captionFadeIn, hold: tuning.captionHold }}
                onDone={handleDone}
                onClear={() => { setPins([]); setDraftId(null); setExpandedPinIds(new Set()); }}
                onReopen={handleReopen}
                onDepart={handleDepart}
                anchor={anchorPin}
                anchorLabel={previousCheckInLabel}
                isReopened={draftId !== null}
                expandedPinIds={expandedPinIds}
                onExpandPin={handleExpandPin}
                selectedPinId={effectiveSelectedPinId}
                onSelectPin={setSelectedPinId}
                enteringPinId={enteringPinId}
                scrollRef={railScrollRef}
                expanded={mirrorExpanded}
                onToggle={() => setMirrorExpanded((v) => !v)}
                draggingPinId={draggingPinId}
              />
            )}
          </AnimatePresence>

          {/* Pin-to-card thread — desktop only, follows the selected card.
              Not drawn when the active pin is only a fallback resolution
              (see tetherSuppressed above) — nothing has actually been
              selected yet. */}
          {sideBySide && selectedPin && !tetherSuppressed && (
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
