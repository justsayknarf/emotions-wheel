import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, motionValue, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { WordScreenPos } from './EmotionWord';
import { animate } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';
import { emotions } from '../../data/emotions';
import { getRegionDescription } from '../../data/regions';
import { findNearbyPinPx } from '../../data/checkIn';
import { useProximity, VISIBILITY_RADIUS, DEEP_REVEAL_CAP } from '../../hooks/useProximity';
import { useFieldGesture } from '../../hooks/useFieldGesture';
import { EmotionWord, LABEL_STANDOFF, type TagPulse } from './EmotionWord';
import { labelHalfWidth, LABEL_LINE_H } from './deoverlap';
import { computeRadialFan, type FanBox } from './radialFan';
import { WordTethers, type TetherSegment } from './WordTethers';
import { LiveDraftGlow } from './LiveDraftGlow';
import { FieldSignal } from './FieldSignal';
import { FieldAura } from './FieldAura';
import { AxisRadiance } from './AxisRadiance';
import { DepartureTrace } from './DepartureTrace';
import { SkyBackdrop, type ConstellationStar, type SkyDeparture } from './SkyBackdrop';
import { SkyAurora, type SkyAuroraInputs } from './SkyAurora';
import { canUseWebGL } from './skyShader';
import { usePinLanding, PIN_RING_SIZE } from './usePinLanding';
import { useRevealTuning, cameraParamsFrom } from '../../config/revealTuning';
import { toPercent } from '../../utils/fieldGeometry';
import { flatProjection, skyProjection } from '../../utils/skyProjection';
import { cameraTarget, degToField } from '../../utils/skyCamera';
import { useSkyCamera } from './useSkyCamera';
import { clampIntroDuration, introStart, type IntroSpec } from '../../utils/skyIntro';

// A revealed label draws a tether back to its dot once it sits this far from the
// coordinate. Above the resting standoff (so a merely-lifted label has none),
// below a real de-overlap displacement. (U4, tune per Q3)
const TETHER_THRESHOLD = 26;
import type { PinEntry } from '../../types';
import { placeAnchorLabel, ANCHOR_LABEL_H } from './anchorLabel';
import { DefinitionTip } from './DefinitionTip';
import {
  definitionBounds as computeDefinitionBounds,
  hitTestWord,
  nearestWordId,
  LABEL_OBSTACLE_WEIGHT,
  MARK_OBSTACLE_WEIGHT,
  type Obstacle,
  type TipLayout,
  type WordTarget,
} from './definitionPlacement';
import { definitionFor } from '../../data/descriptions';

// The previous check-in's anchor mark: a hollow ring with its day label ("TODAY").
// Shared by the render and the fan's obstacle boxes, so revealed labels are
// kept off the mark at the size it actually draws.
const ANCHOR_RING_SIZE = { rest: 11, emphasized: 14 };
const ANCHOR_LABEL_CHAR_W = 6; // px/char at the 8px tracked uppercase size

const AXIS_LABEL: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 5,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

// Opaque bone — brightness is carried by the element's animated opacity, not the
// colour alpha, so the labels can pulse above their emphasized level.
const AXIS_TEXT = 'var(--ui-text-1)';

// Partition once at module load — emotions array is a static import constant
const surfaceEmotions = emotions.filter(e => e.depth === 'surface');
const deepEmotions = emotions.filter(e => e.depth === 'deep');

interface Props {
  pins: PinEntry[];
  highlightedIds: Set<string>;
  // The user's latest tag toggle; handed only to the word it names.
  tagPulse?: TagPulse | null;
  onPinRelease: (entry: PinEntry) => void;
  // R15: a release that lands on an existing (draft) pin selects it instead
  // of minting a new one — see handleRelease's hit-test via findNearbyPinPx,
  // measured where the pins actually draw.
  onPinSelect: (pinId: string) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
  // When true (e.g. the first-run demo), the axes brighten above their
  // resting level and settle back when it clears.
  axisEmphasis?: boolean;
  // The previous check-in's pins (R10): stay on the field, quieter and in a
  // distinct hue from the draft (R11). Kept as a separate prop rather than
  // merged into `pins` deliberately — see U4's design note — so selectedIds,
  // pairIds, deepOpacityMap and fociPx (all derived from `pins` above) never
  // pick these up, and the adjust overlay (which searches only `pins`) stays
  // draft-only for free.
  recordedPins?: PinEntry[];
  // U4/R5: the previous check-in's relative-day label (e.g. "TUE"), already
  // resolved by relativeDayLabel (src/data/departure.ts) once in App so the
  // field's anchor label and the card's delta sentence (U3) read the same
  // value rather than each deriving their own. Rendered on the anchor pin
  // only — recordedPins's own last entry, matching departureAnchor.
  previousCheckInLabel?: string | null;
  // The pin whose card is currently selected in the tray — rendered larger and
  // brighter so the card↔point link reads both ways.
  emphasizedPinId?: string | null;
  // The live coordinate while the selected pin's card slider is being
  // dragged — null once released or cancelled. Shares one glow-marker
  // treatment with departureDraft below (see `liveDraft`) rather than its
  // own dashed-travel-line/origin-ring overlay, which this used to render
  // alone.
  adjustDraft?: { x: number; y: number } | null;
  // Fires once a field press-and-drag (placing or selecting a pin) crosses
  // the tap/drag movement threshold, and again with `false` on release or
  // cancel — drives the tray's peek during pin placement (U3). Optional.
  onGestureActiveChange?: (active: boolean) => void;
  // Night sky only: true while a drag holds the sky (drag-to-pan), false
  // when it lets go or is cancelled. The phone tray hides for its length.
  onSkyPanChange?: (active: boolean) => void;
  // U6/R6: the departure connector's one-shot trigger — increments once per
  // departure commit (App's handleDepart), paired with the anchor/new-pin
  // field-space coordinates that commit departed between. Optional: the
  // trace simply never fires if these are never populated.
  departureTracePlay?: number;
  departureTraceFrom?: { x: number; y: number } | null;
  departureTraceTo?: { x: number; y: number } | null;
  // U1: how far the field is receded (0 = focused/today's rail, 1 = fully
  // receded behind the front-and-center card). The actual scale/blur
  // transform is applied one level up, on the App.tsx wrapper this
  // component's containerRef sits inside (so it stays in sync with
  // getBoundingClientRect — see useFieldGesture.ts) — this prop only drives
  // the field's own pointer/hover affordance (R5: it must keep reading as
  // directly pressable once visually backgrounded), not the transform
  // itself. Left at its default (0) until U2-U5 wire real state through.
  recedeProgress?: number;
  // docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, U4: the
  // live coordinate while a DepartureFloat slider is being dragged (field
  // preview only, pre-mint) — null once released or cancelled. Feeds the
  // same proximity/dwell reveal machinery a pointer hover already drives,
  // and renders a small glow marker — the same one `adjustDraft` above now
  // shares (see `liveDraft`). A drag is treated as press-equivalent, not
  // hover-equivalent — no dwell delay.
  departureDraft?: { x: number; y: number } | null;
  // docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, U4: true
  // while a direct field press is a deliberate no-op (the pre-mint
  // departure-float landing, where the slider is the only commit path) —
  // suppresses the same "directly pressable" affordance recedeProgress
  // drives below, so the cursor/hover ring don't imply a click here would
  // do something.
  dropDisabled?: boolean;
  // Night sky, phone layout: the stage-px y at which the bottom tray's resting
  // top edge covers the stage (the field runs on behind it). The camera
  // centres on the sky above it rather than on the whole stage. Null or
  // omitted: nothing covers the stage.
  skyOccluderTop?: number | null;
  // Bumped once per saved check-in: the night sky's aurora swells once (living-sky R11).
  skySwellPlay?: number;
  // Open with the rise from the Negative horizon to the still point (sky
  // mode only). Read once at mount; App passes it while the welcome shows.
  skyIntro?: boolean;
  // The word whose definition tooltip is open, and the layout it uses
  // (word-definition-tooltips). App's useDefinitionTooltip owns this state.
  definitionOpenId?: string | null;
  definitionLayout?: TipLayout;
  // Stage px at the top the tooltip keeps clear of (the header pills).
  definitionTopInset?: number;
  // The pointer is over this word (or none): field-side hover (R4).
  onDefinitionHover?: (id: string | null) => void;
  // A field press began (R9).
  onDefinitionPress?: () => void;
  // A field press ended. restId is the word nearest the resting pin in the
  // band layout (R10), else null.
  onDefinitionRelease?: (restId: string | null) => void;
  // The band tooltip card was tapped: close it.
  onDefinitionDismiss?: () => void;
}

export function EmotionField({
  pins,
  highlightedIds,
  tagPulse = null,
  onPinRelease,
  onPinSelect,
  onFirstInteraction,
  hasInteracted,
  axisEmphasis = false,
  recordedPins = [],
  previousCheckInLabel = null,
  emphasizedPinId = null,
  adjustDraft = null,
  onGestureActiveChange,
  onSkyPanChange,
  departureTracePlay = 0,
  departureTraceFrom = null,
  departureTraceTo = null,
  recedeProgress = 0,
  departureDraft = null,
  dropDisabled = false,
  skyOccluderTop = null,
  skySwellPlay = 0,
  skyIntro = false,
  definitionOpenId = null,
  definitionLayout = 'tethered',
  definitionTopInset = 0,
  onDefinitionHover,
  onDefinitionPress,
  onDefinitionRelease,
  onDefinitionDismiss,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tuning = useRevealTuning();
  const reducedMotion = useReducedMotion();
  // Every coordinate → px placement in this field goes through `proj`, so
  // the flat field and the night-sky field share one code path. In sky mode
  // `proj` changes every camera frame (useSkyCamera); in flat mode it only
  // changes with the stage size.
  const sky = tuning.skyField;
  const cameraParams = useMemo(() => cameraParamsFrom(tuning), [tuning]);
  const newestDraftPin = pins.length ? pins[pins.length - 1] : null;
  // The emphasized pin, whichever group it belongs to (draft or recorded).
  const emphasizedAny = emphasizedPinId
    ? pins.find((p) => p.id === emphasizedPinId) ?? recordedPins.find((p) => p.id === emphasizedPinId) ?? null
    : null;
  const skyTarget = cameraTarget({
    liveDraft: departureDraft ?? adjustDraft,
    emphasizedPin: emphasizedAny,
    newestDraftPin,
    recordedAnchor: recordedPins.length ? recordedPins[recordedPins.length - 1] : null,
  });
  // The visible band of sky: everything above the tray's top edge. A tray
  // that sits below the stage (or no tray) leaves the whole stage.
  const skyViewport = useMemo(
    () => (skyOccluderTop !== null && size.height > 0 && skyOccluderTop < size.height - 0.5
      ? { top: 0, height: Math.max(size.height * 0.25, skyOccluderTop) }
      : null),
    [skyOccluderTop, size.height],
  );
  const [introSpec] = useState<IntroSpec | null>(() =>
    sky && skyIntro && tuning.skyIntro
      // Clamped so no admin duration outruns the opening pan's own ceiling
      // (R13), skyIntroMaxDeg — not the camera's pan cap, which governs
      // every other glide.
      ? clampIntroDuration(
          { from: introStart(cameraParams.lookMax), to: { x: 0, y: 0 }, delayS: tuning.skyIntroDelay, durationS: tuning.skyIntroDuration },
          degToField(tuning.skyIntroMaxDeg),
        )
      : null,
  );
  // useFieldGesture (isPressed) runs after the camera, so a press reaches
  // the intro through this ref, written in the aurora layout effect below.
  // It latches: a tap whose down and up both land between two camera ticks
  // (a load-time stall) would otherwise read false; a pin planted since
  // mount counts as interaction too.
  const introInterrupt = useRef(false);
  const [mountPinCount] = useState(pins.length);
  const { proj, look: skyLook, fovDeg: skyFovDeg, pan: skyPan } = useSkyCamera({
    enabled: sky,
    target: skyTarget,
    lean: pins.length > 0 || departureDraft !== null,
    params: cameraParams,
    size,
    viewport: skyViewport,
    intro: introSpec,
    interruptRef: introInterrupt,
  });
  const toFieldPx = (c: { x: number; y: number }) => proj.toPx(c);

  // U1: this stays the source of truth for layout math (word/pin positions,
  // fan geometry, etc. below) — it is NOT used for gesture-time coordinate
  // normalization any more (see useFieldGesture.ts's getCoord), because
  // ResizeObserver's contentRect never reflects a CSS transform applied to
  // this element or an ancestor of it (U1's recede wrapper in App.tsx), so
  // it would go stale relative to the transform-aware getBoundingClientRect
  // gesture math reads instead.
  const sizeRef = useRef(size);
  useLayoutEffect(() => {
    sizeRef.current = size;
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Things outside the field that measure drawn positions from the DOM (the
  // rail Tether reads [data-field-pin]) can't see a camera frame: App doesn't
  // re-render for one. Tell them, once the frame's positions are committed.
  useLayoutEffect(() => {
    if (!sky) return;
    containerRef.current?.dispatchEvent(new CustomEvent('fieldprojectionchange', { bubbles: true }));
  }, [sky, proj]);

  // Deep words' screen positions, as motion values written every projection.
  // A word leaving the sky fades out under AnimatePresence, which freezes its
  // last props; a number x/y would pin the fade to one spot on the glass while
  // the camera pans. The motion values keep tracking, so it fades in place on
  // the dome. Behind the camera there is no position: the word hides instead.
  const [deepPos] = useState(() => new Map<string, WordScreenPos>(
    deepEmotions.map((e) => [e.id, { x: motionValue(0), y: motionValue(0), visibility: motionValue('hidden') }]),
  ));
  useLayoutEffect(() => {
    for (const e of deepEmotions) {
      const pos = deepPos.get(e.id)!;
      const at = proj.toPx(e);
      if (at.visible) {
        pos.x.set(at.x);
        pos.y.set(at.y);
      }
      pos.visibility.set(at.visible ? 'visible' : 'hidden');
    }
  }, [deepPos, proj]);

  const handleRelease = useCallback((center: { x: number; y: number }) => {
    // Band layout (phone tray): the word nearest where the pin comes to rest
    // gets its definition after the delay (R10). The nearest word in reach is
    // always revealed: surface words always show, and a pin reveals its
    // nearest deep words.
    onDefinitionRelease?.(
      definitionLayout === 'band' ? nearestWordId(center, emotions, VISIBILITY_RADIUS) : null,
    );
    // R15: before minting a new pin, check whether the release lands close
    // enough to an existing pin — draft or recorded — to select it instead.
    // Pin dots render with pointerEvents: 'none' — the field is the single
    // pointer target — so this hit-test at release time is the only
    // mechanism for "clicking" a pin. Recorded pins remain selectable
    // throughout (U4): searching both arrays here does not fold recordedPins
    // into `pins` itself, so selectedIds/pairIds/deepOpacityMap/fociPx above
    // still derive from draft pins only.
    const nearby = findNearbyPinPx(proj.toPx(center), [...pins, ...recordedPins], proj);
    if (nearby) {
      onPinSelect(nearby.id);
      return;
    }

    // The pin carries only its coordinate + narrative. Which emotions it
    // highlights is derived from the pin (in App), so the highlighted set can
    // never drift from the pin — see nearestTagIds / the selected-pin memo.
    const entry: PinEntry = {
      id: uuidv4(),
      x: center.x,
      y: center.y,
      recognizedWords: [],
      regionDescription: getRegionDescription(center.x, center.y, emotions),
    };
    onPinRelease(entry);
  }, [onPinRelease, onPinSelect, pins, recordedPins, proj, onDefinitionRelease, definitionLayout]);

  // Pin lands, field notices (usePinLanding). Its anime scope is rooted at the
  // field container, so the container takes both refs.
  const landingRootRef = usePinLanding(pins, size, surfaceEmotions, proj);
  const setContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    landingRootRef.current = el;
  }, [landingRootRef]);

  // Drag-to-pan on the night sky: a press that travels drags the dome, and
  // its release plants nothing. A tap still plants a pin.
  const fieldPan = useMemo(
    () => (sky
      ? {
        start: () => {
          skyPan.start();
          onSkyPanChange?.(true);
        },
        move: (dx: number, dy: number, rect: DOMRect) => {
          const sx = rect.width > 0 && sizeRef.current.width > 0 ? sizeRef.current.width / rect.width : 1;
          skyPan.move(dx * sx, dy * sx);
        },
        end: () => {
          skyPan.end();
          onSkyPanChange?.(false);
          onDefinitionRelease?.(null);
        },
      }
      : undefined),
    [sky, skyPan, onDefinitionRelease, onSkyPanChange],
  );
  const { isPressed, isPanning, isRevealed, revealCenter, dwellCenter, handlers } = useFieldGesture({
    containerRef,
    onRelease: handleRelease,
    onFirstInteraction,
    hasInteracted,
    onGestureActiveChange,
    // Presses arrive in the (possibly transformed) rect's px; rescale them to
    // layout px, the space `proj` works in. Before ResizeObserver's first
    // callback `size` is still 0, so fall back to a projection over the rect
    // itself — the flat mapping, exactly what getCoord computed before, or
    // the sky from the camera's current gaze.
    toCoord: (lx, ly, rect) =>
      size.width === 0 || size.height === 0
        ? sky
          ? skyProjection({ look: skyLook, fovDeg: skyFovDeg, width: rect.width, height: rect.height }).fromPx(lx, ly)
          : flatProjection(rect).fromPx(lx, ly)
        : proj.fromPx(lx * (size.width / rect.width), ly * (size.height / rect.height)),
    pan: fieldPan,
  });
  // U1: hover-only (no active press) — the receded field's pointer/hover
  // affordance should read as "backgrounded but reachable," not fight with
  // an in-flight press/drag. isRevealed is isPressed || isHovering
  // internally (useFieldGesture.ts), so this recovers the hover-only half
  // without widening that hook's own return shape.
  const isHoveringOnly = isRevealed && !isPressed;

  const selectedIds = useMemo(
    () => new Set(pins.flatMap((p) => p.recognizedWords)),
    [pins],
  );
  // Follow-up to docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md:
  // one unified "live glow" coordinate for both slider-driven drags this
  // field ever reacts to — a pre-mint DepartureFloat drag (departureDraft)
  // and an ordinary post-mint adjust-slider drag on an already-selected pin
  // (adjustDraft). The two are mutually exclusive by construction (a
  // DepartureFloat drag only ever happens pre-mint, pins.length === 0; an
  // adjust drag only ever happens on an existing pin) — never both truthy
  // at once — so a single value with one glow-marker treatment can drive
  // every reveal/render site below instead of each prop getting its own
  // parallel mechanism (previously: a glow for departureDraft, a dashed
  // travel-line + origin ring for adjustDraft). `liveDraftAccent` is the
  // only place the two still diverge — gold for adjusting a pin that's
  // already yours, the cool recorded hue for a coordinate that isn't yet.
  const liveDraft = departureDraft ?? adjustDraft;
  const liveDraftAccent: 'gold' | 'recorded' = departureDraft ? 'recorded' : 'gold';

  // The WebGL sky beneath the stars (SkyAurora). WebGL decided once per
  // mount; without it the 2D backdrop paints the sky (R7). Per-frame values
  // reach the shader through this ref, never props, so a camera frame
  // re-renders nothing but this field.
  const [webgl, setWebgl] = useState(() => sky && canUseWebGL());
  const onAuroraUnavailable = useCallback(() => setWebgl(false), []);
  const auroraInputs = useRef<SkyAuroraInputs>({ proj, moving: false, swell: 0 });
  // R3F's invalidate, for reduced motion's frameloop="demand".
  const auroraInvalidate = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const moving = isPressed || liveDraft !== null;
    const moved = auroraInputs.current.proj !== proj || auroraInputs.current.moving !== moving;
    auroraInputs.current.proj = proj;
    auroraInputs.current.moving = moving;
    if (moving || pins.length !== mountPinCount) introInterrupt.current = true;
    if (moved && reducedMotion) auroraInvalidate.current?.();
  });

  // One saved check-in → one swell: the aurora brightens and settles.
  const swellTarget = useRef({ v: 0 });
  const swellAnim = useRef<{ cancel: () => unknown } | null>(null);
  const { root: swellRoot, scope: swellScope } = useAnimeScope<HTMLDivElement>((scope, reduced) => {
    scope.add('swell', () => {
      if (reduced) return; // no swell under reduced motion (R11)
      // A second save mid-swell stops the first; the new one starts from the
      // current value, so the envelope never jumps and always ends at 0.
      swellAnim.current?.cancel();
      swellAnim.current = animate(swellTarget.current, {
        v: [{ to: 1, duration: 800, ease: 'out(2)' }, { to: 0, duration: 2400, ease: 'inOut(2)' }],
        onUpdate: () => { auroraInputs.current.swell = swellTarget.current.v; },
      });
    });
  }, []);
  useEffect(() => {
    if (skySwellPlay > 0) swellScope.current?.methods.swell();
  }, [skySwellPlay, swellScope]);

  // A departure/adjust drag takes over as the reveal center whenever it's
  // active — press-equivalent (not hover-equivalent), same as the field's
  // own onPointerDown already treats a real press. liveDraft and a field
  // hover can't collide in practice: DepartureFloat's own DOM sits outside
  // the field container (rendered by EmotionDrawer, a sibling), so a
  // pointerdown on a slider track never reaches this field's own pointer
  // handlers at all; an adjust-slider drag is driven from inside the same
  // tray, same story.
  const revealAnchor = liveDraft ?? revealCenter;
  const revealActive = liveDraft !== null || isRevealed;
  const proximity = useProximity(surfaceEmotions, revealAnchor, revealActive, selectedIds);

  // The two emotions the selected card names ("between X and Y") — the nearest
  // pair, within range, to the emphasized pin. Recomputed from the pin itself
  // (not the highlighted set) so it stays correct when an older card is
  // reselected. While these two are lifted, everyone else revealed recedes,
  // so the card's phrase reads against the geometry.
  const pairIds = useMemo(() => {
    const set = new Set<string>();
    if (!emphasizedPinId) return set;
    const pin = pins.find((p) => p.id === emphasizedPinId);
    if (!pin) return set;
    const nearby: Array<{ id: string; dist: number }> = [];
    for (const e of emotions) {
      const dist = Math.sqrt((e.x - pin.x) ** 2 + (e.y - pin.y) ** 2);
      if (dist <= VISIBILITY_RADIUS) nearby.push({ id: e.id, dist });
    }
    nearby.sort((a, b) => a.dist - b.dist);
    for (const n of nearby.slice(0, 2)) set.add(n.id);
    return set;
  }, [emphasizedPinId, pins]);

  // Recede only kicks in when the card actually names a pair (≥2 words in
  // range) and the knob is above zero.
  const recedeActive = pairIds.size === 2 && tuning.recedeStrength > 0;

  // Pin-based proximity for deep emotions — the emphasized (selected) pin
  // reveals its nearest DEEP_REVEAL_CAP words. Only the selected pin reveals a
  // deep neighbourhood: other pins' deep words would clutter the field and make
  // it harder to anchor what the selected card names. (Other pins keep their
  // dots — rendered below — just not their word labels.) With no pin emphasized
  // we fall back to the full constellation.
  const deepOpacityMap = useMemo(() => {
    const map = new Map<string, number>();
    // The live coordinate joins the reveal source exactly like a pin would
    // — immediate (no dwell delay), since a drag is a deliberate gesture,
    // not passive hovering. A bare {x,y} is fine here: the loop below only
    // ever reads `.x`/`.y` off each entry. An adjust drag REPLACES the
    // emphasized pin's own (stale, pre-drag) position rather than adding
    // to it — the live position is what's actually near the cursor's
    // target right now; revealing near both would read as two competing
    // reveal centers for what's really one continuous gesture.
    const source: Array<{ x: number; y: number }> = [];
    if (emphasizedPinId) {
      if (adjustDraft) {
        source.push(adjustDraft);
      } else {
        const emphasizedPin = pins.find((p) => p.id === emphasizedPinId);
        if (emphasizedPin) source.push(emphasizedPin);
      }
    } else {
      source.push(...pins);
    }
    if (departureDraft) source.push(departureDraft);
    for (const pin of source) {
      const eligible: Array<{ id: string; t: number; dist: number }> = [];
      for (const e of deepEmotions) {
        const dist = Math.sqrt((e.x - pin.x) ** 2 + (e.y - pin.y) ** 2);
        if (dist <= VISIBILITY_RADIUS) {
          eligible.push({ id: e.id, t: 1 - dist / VISIBILITY_RADIUS, dist });
        }
      }
      eligible.sort((a, b) => a.dist - b.dist);
      for (const { id, t } of eligible.slice(0, DEEP_REVEAL_CAP)) {
        if (t > (map.get(id) ?? 0)) map.set(id, t);
      }
    }
    return map;
  }, [pins, emphasizedPinId, adjustDraft, departureDraft]);

  // Dwell-based proximity for deep emotions — follows cursor, transient
  const dwellOpacityMap = useMemo(() => {
    const map = new Map<string, { opacity: number; rank: number }>();
    if (!dwellCenter) return map;
    const eligible: Array<{ id: string; opacity: number; dist: number }> = [];
    for (const e of deepEmotions) {
      const dist = Math.sqrt((e.x - dwellCenter.x) ** 2 + (e.y - dwellCenter.y) ** 2);
      if (dist <= VISIBILITY_RADIUS) {
        eligible.push({ id: e.id, opacity: 1 - dist / VISIBILITY_RADIUS, dist });
      }
    }
    // Sort key is dwellCenter (the frozen anchor), not the live cursor —
    // the capped set must not churn as the cursor drifts after dwell fires
    eligible.sort((a, b) => a.dist - b.dist);
    eligible.slice(0, DEEP_REVEAL_CAP).forEach(({ id, opacity }, rank) => {
      map.set(id, { opacity, rank });
    });
    return map;
  }, [dwellCenter]);

  // The deep words currently on screen: revealed by dwell, by a pin, or fixed
  // because they are selected/highlighted.
  //
  // During an adjust drag the highlighted set is stale — App derives it from
  // the committed pin, not the live position — so it drops out until release
  // re-derives it at the new spot. Kept, it doubled the revealed words (the
  // live neighbourhood plus the old one) and the fan flung them all far out.
  // Tagged words (selectedIds) stay: they are the user's choice, not a guess.
  // Words behind the sky camera don't render.
  const revealedDeep = useMemo(
    () =>
      deepEmotions.filter(
        (e) =>
          (dwellOpacityMap.has(e.id) ||
            deepOpacityMap.has(e.id) ||
            selectedIds.has(e.id) ||
            (!adjustDraft && highlightedIds.has(e.id))) &&
          proj.toPx(e).visible,
      ),
    [dwellOpacityMap, deepOpacityMap, selectedIds, highlightedIds, adjustDraft, proj],
  );

  // The sky's stars (R6) and constellation chain (R8). Sky mode only reads them.
  const revealedIds = useMemo(() => new Set(revealedDeep.map((e) => e.id)), [revealedDeep]);
  const skyStars = useMemo(
    () => emotions.map((e) => ({ id: e.id, x: e.x, y: e.y, surface: e.depth === 'surface', tagged: selectedIds.has(e.id), revealed: revealedIds.has(e.id) })),
    [selectedIds, revealedIds],
  );
  // The chain for the pin the user is looking at: the emphasized pin, else the
  // only draft pin. Tag order is recognizedWords order.
  const constellationPin = emphasizedAny ?? (pins.length === 1 ? pins[0] : null);
  // Each star keyed so SkyBackdrop knows a segment across renders (a new one
  // animates in, one already there draws at rest).
  const constellation = useMemo<ConstellationStar[]>(() => {
    if (!constellationPin) return [];
    const byId = new Map(emotions.map((e) => [e.id, e]));
    return [
      { key: `pin:${constellationPin.id}`, x: constellationPin.x, y: constellationPin.y },
      ...constellationPin.recognizedWords
        .map((id) => byId.get(id))
        .filter((e): e is NonNullable<typeof e> => !!e)
        .map((e) => ({ key: e.id, x: e.x, y: e.y })),
    ];
  }, [constellationPin]);

  // The departure comet in the sky (R10) draws on SkyBackdrop's canvas, its
  // ends re-projected every frame as the camera glides to the new pin; the
  // flat field's DepartureTrace measures px once at play-start instead.
  const skyDeparture = useMemo<SkyDeparture>(
    () => ({
      play: departureTracePlay,
      from: departureTraceFrom,
      to: departureTraceTo,
      travel: tuning.departureTravel,
      trail: tuning.departureTrail,
      hold: tuning.departureHold,
      fadeOut: tuning.departureFadeOut,
      strength: tuning.departureStrength,
    }),
    [departureTracePlay, departureTraceFrom, departureTraceTo, tuning.departureTravel, tuning.departureTrail, tuning.departureHold, tuning.departureFadeOut, tuning.departureStrength],
  );

  // Live cursor proximity for the revealed deep words, so they react to the
  // cursor (size + colour) the way surface anchors do. Only the scale/nearness
  // are used — a deep word's visibility stays reveal-driven, not cursor-driven.
  // Same revealAnchor/revealActive substitution as the surface-word
  // proximity above (now liveDraft-driven) — without it, a deep word
  // revealed via a departure/adjust drag (deepOpacityMap, above) would
  // never react to the live coordinate's proximity, unlike every other
  // reveal trigger in the app.
  const deepProximity = useProximity(revealedDeep, revealAnchor, revealActive, selectedIds);

  // Reveal foci in pixel space: the dwell centre (when dwelling) and the
  // emphasized pin/live draft. Each revealed word fans out of its nearest
  // focus — scoped to the selected pin so the fan matches the words we
  // actually reveal (above), and no other pin pulls a label toward it.
  // Full constellation when nothing is emphasized.
  //
  // A selected recorded pin is a focus too. App lights its card's nearest
  // words (highlightedIds), and without a focus here those words had nothing
  // to fan out of and stacked on top of each other. Resolved on its own rather
  // than by folding recordedPins into `pins` — see the prop's note.
  const emphasizedRecordedPin = emphasizedPinId
    ? recordedPins.find((p) => p.id === emphasizedPinId) ?? null
    : null;
  // The newest recorded pin carries the anchor mark — same rule as the
  // recorded-pin render below (isAnchor) and departureAnchor.
  const recordedAnchor = recordedPins.length > 0 ? recordedPins[recordedPins.length - 1] : null;
  const fociPx = useMemo(() => {
    if (size.width === 0) return [] as Array<{ x: number; y: number }>;
    const arr: Array<{ x: number; y: number }> = [];
    // A focus behind the sky camera has no screen position to fan out of.
    const push = (c: { x: number; y: number }) => {
      const p = proj.toPx(c);
      if (p.visible) arr.push({ x: p.x, y: p.y });
    };
    if (dwellCenter) push(dwellCenter);
    // Without this, a deep word revealed by a departure drag (no pin, no
    // dwell) would fan out of computeRadialFan's no-focus fallback (the
    // revealed dots' centroid) rather than out of the live coordinate.
    if (departureDraft) push(departureDraft);
    // Same live-position substitution as deepOpacityMap above — an adjust
    // drag fans out from where the pin actually is right now, not its
    // stale pre-drag position.
    if (emphasizedPinId) {
      if (adjustDraft) {
        push(adjustDraft);
      } else {
        const emphasizedPin = pins.find((p) => p.id === emphasizedPinId) ?? emphasizedRecordedPin;
        if (emphasizedPin) push(emphasizedPin);
      }
    } else {
      for (const p of pins) push(p);
    }
    return arr;
  }, [dwellCenter, departureDraft, adjustDraft, pins, emphasizedPinId, emphasizedRecordedPin, size.width, proj]);

  // Lay the revealed labels out as a fan around their nearest focus: each rides
  // a ray out of the cursor/pin, with a no-crossing pass so their tethers never
  // tangle. Surface labels are fixed obstacles; dots never move — only the
  // label callouts. (Q3 radial-fan reveal)
  //
  // The previous check-in's anchor mark is resolved first: its ring, and where
  // its day label sits — above the ring unless a surface word is already there
  // (placeAnchorLabel). The render and the fan both read this one value, so
  // revealed words steer around the label where it actually draws.
  const anchorMark = useMemo(() => {
    if (!recordedAnchor || size.width === 0) return null;
    const ringSize = recordedAnchor.id === emphasizedPinId ? ANCHOR_RING_SIZE.emphasized : ANCHOR_RING_SIZE.rest;
    const { x, y, visible } = proj.toPx(recordedAnchor);
    // Behind the sky camera the mark doesn't draw, so it is no obstacle.
    if (!visible) return null;
    const label = previousCheckInLabel
      ? placeAnchorLabel(
          { x, y, size: ringSize },
          (previousCheckInLabel.length * ANCHOR_LABEL_CHAR_W) / 2,
          surfaceEmotions.flatMap((e) => {
            const p = proj.toPx(e);
            if (!p.visible) return [];
            return {
              x: p.x,
              y: p.y - LABEL_STANDOFF,
              halfW: labelHalfWidth(e.label, e.depth),
              halfH: LABEL_LINE_H / 2,
            };
          }),
        )
      : null;
    return { id: recordedAnchor.id, x, y, ringSize, label };
  }, [recordedAnchor, emphasizedPinId, previousCheckInLabel, size.width, proj]);

  const deepLabelOffsets = useMemo(() => {
    if (size.width === 0 || revealedDeep.length === 0) {
      return new Map<string, { dx: number; dy: number }>();
    }
    const fanBox = (
      e: (typeof emotions)[number],
      movable: boolean,
    ): FanBox => {
      const { x: dotX, y: dotY } = proj.toPx(e);
      return {
        id: e.id,
        dotX,
        dotY,
        cx: dotX,
        cy: dotY - LABEL_STANDOFF,
        halfW: labelHalfWidth(e.label, e.depth),
        halfH: LABEL_LINE_H / 2,
        movable,
      };
    };
    // Surface words behind the sky camera don't draw, so they're no obstacle.
    const boxes: FanBox[] = [
      ...surfaceEmotions.filter((e) => proj.toPx(e).visible).map((e) => fanBox(e, false)),
      ...revealedDeep.map((e) => fanBox(e, true)),
    ];
    // The anchor mark's ring and day label are fixed obstacles too, so no
    // revealed word settles on top of either.
    if (anchorMark) {
      const obstacle = (key: string, cx: number, cy: number, halfW: number, halfH: number): FanBox => ({
        id: `anchor-${key}:${anchorMark.id}`, dotX: cx, dotY: cy, cx, cy, halfW, halfH, movable: false,
      });
      const ringHalf = anchorMark.ringSize / 2 + 2;
      boxes.push(obstacle('ring', anchorMark.x, anchorMark.y, ringHalf, ringHalf));
      const l = anchorMark.label;
      if (l) boxes.push(obstacle('label', anchorMark.x + l.dx, anchorMark.y + l.dy, l.halfW, l.halfH));
    }
    // A focus's reach is the reveal radius in pixels — toPercent maps one
    // coordinate unit to 45% of the field — on the longer axis, since the field
    // is not square. Only words inside it set that focus's ring.
    const reach = VISIBILITY_RADIUS * 0.45 * Math.max(size.width, size.height);
    return computeRadialFan(boxes, fociPx, tuning, reach);
  }, [revealedDeep, fociPx, anchorMark, size.width, size.height, proj, tuning]);

  // A tether is drawn (and then faded) from each fanned label back to its dot,
  // staggered so the nearest word to a focus draws first.
  const wordTethers = useMemo<TetherSegment[]>(() => {
    if (size.width === 0) return [];
    const raw: Array<{ seg: TetherSegment; d: number }> = [];
    for (const e of revealedDeep) {
      const o = deepLabelOffsets.get(e.id) ?? { dx: 0, dy: 0 };
      const dispX = o.dx;
      const dispY = o.dy - LABEL_STANDOFF;
      if (Math.hypot(dispX, dispY) <= TETHER_THRESHOLD) continue;
      const { x: cx, y: cyCoord } = proj.toPx(e);
      const d = fociPx.length
        ? Math.min(...fociPx.map((f) => Math.hypot(cx - f.x, cyCoord - f.y)))
        : 0;
      // Aim the tether at the label's centre but terminate at the edge of its
      // bounding box (plus a small gap), along the ray from the centre toward
      // the dot. So the line points at the word without ever running under the
      // glyphs — regardless of which side the dot sits on.
      const lcx = cx + o.dx;
      const lcy = cyCoord - LABEL_STANDOFF + o.dy;
      const halfW = labelHalfWidth(e.label, e.depth);
      const halfH = LABEL_LINE_H / 2;
      const gap = 4;
      const toDotX = cx - lcx;
      const toDotY = cyCoord - lcy;
      const tX = toDotX !== 0 ? (halfW + gap) / Math.abs(toDotX) : Infinity;
      const tY = toDotY !== 0 ? (halfH + gap) / Math.abs(toDotY) : Infinity;
      const t = Math.min(tX, tY, 1);
      raw.push({
        d,
        seg: {
          id: e.id,
          x1: cx,
          y1: cyCoord,
          x2: lcx + toDotX * t,
          y2: lcy + toDotY * t,
        },
      });
    }
    raw.sort((a, b) => a.d - b.d);
    return raw.map(({ seg }, i) => ({ ...seg, delay: i * tuning.staggerStep }));
  }, [revealedDeep, deepLabelOffsets, fociPx, size.width, proj, tuning]);

  // Every word as it draws right now, for the hover hit-test and as obstacles
  // for the definition tooltip. Words are pointerEvents: none — the field is
  // the only pointer target — so hover is found in px here.
  const wordTargets = useMemo<WordTarget[]>(() => {
    if (size.width === 0) return [];
    const out: WordTarget[] = [];
    const add = (e: (typeof emotions)[number], o: { dx: number; dy: number }) => {
      const p = proj.toPx(e);
      if (!p.visible) return;
      out.push({
        id: e.id,
        dotX: p.x,
        dotY: p.y,
        labelX: p.x + o.dx,
        labelY: p.y - LABEL_STANDOFF + o.dy,
        halfW: labelHalfWidth(e.label, e.depth),
        halfH: LABEL_LINE_H / 2,
      });
    };
    for (const e of surfaceEmotions) add(e, { dx: 0, dy: 0 });
    for (const e of revealedDeep) add(e, deepLabelOffsets.get(e.id) ?? { dx: 0, dy: 0 });
    return out;
  }, [size.width, proj, revealedDeep, deepLabelOffsets]);

  // Pointer position in layout px (the space proj works in), corrected for a
  // CSS transform on the field or an ancestor, as toCoord does above.
  const layoutPx = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size.width / rect.width),
      y: (e.clientY - rect.top) * (size.height / rect.height),
    };
  };

  // The open definition: its word, where its star draws, what it should not
  // cover, and the area it may use (the band above the tray on phones).
  const definitionEmotion = definitionOpenId && definitionFor(definitionOpenId)
    ? emotions.find((e) => e.id === definitionOpenId) ?? null
    : null;
  const definitionStar = definitionEmotion ? proj.toPx(definitionEmotion) : null;
  const definitionObstacles = useMemo<Obstacle[]>(() => {
    const out: Obstacle[] = wordTargets
      .filter((t) => t.id !== definitionOpenId)
      .map((t) => ({ x: t.labelX - t.halfW, y: t.labelY - t.halfH, w: t.halfW * 2, h: t.halfH * 2, weight: LABEL_OBSTACLE_WEIGHT }));
    for (const p of pins) {
      const at = proj.toPx(p);
      if (at.visible) out.push({ x: at.x - 10, y: at.y - 10, w: 20, h: 20, weight: MARK_OBSTACLE_WEIGHT });
    }
    if (anchorMark) {
      const r = anchorMark.ringSize / 2 + 10;
      out.push({ x: anchorMark.x - r, y: anchorMark.y - r, w: r * 2, h: r * 2, weight: MARK_OBSTACLE_WEIGHT });
    }
    return out;
  }, [wordTargets, definitionOpenId, pins, proj, anchorMark]);
  const definitionBounds = computeDefinitionBounds(size, definitionLayout, definitionTopInset, skyOccluderTop);
  // A star the tray covers (the flat phone field runs on behind it) gets no
  // tooltip: the band would point at nothing.
  const definitionStarShown = !!definitionStar?.visible &&
    (definitionLayout !== 'band' || definitionStar.y <= definitionBounds.y + definitionBounds.h);

  // Axes read legibly at rest and brighten (emphasis) while the intro runs.
  const crosshairColor = `rgb(var(--ui-gold-rgb) / ${axisEmphasis ? 0.22 : 0.1})`;
  const AXIS_REST = 0.45;    // resting label opacity
  const AXIS_EMPH = 0.75;    // emphasized label opacity

  // The guiding light (AxisRadiance) replays each time emphasis rises. `play` is
  // a rising-edge nonce of axisEmphasis; it starts at 1 so the light also runs
  // on the first intro.
  const [play, setPlay] = useState(1);
  const prevEmph = useRef(axisEmphasis);
  useEffect(() => {
    if (axisEmphasis && !prevEmph.current) setPlay((p) => p + 1);
    prevEmph.current = axisEmphasis;
  }, [axisEmphasis]);

  // Labels brighten with emphasis; the radiating light does the guiding.
  const labelAnim = {
    animate: { opacity: axisEmphasis ? AXIS_EMPH : AXIS_REST },
    transition: { duration: tuning.axisFade, ease: 'easeInOut' as const },
  };

  return (
    <div
      ref={setContainerRef}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={(e) => {
        handlers.onPointerLeave(e);
        if (e.pointerType !== 'touch') onDefinitionHover?.(null);
      }}
      onPointerDown={(e) => {
        onDefinitionPress?.();
        handlers.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        handlers.onPointerMove(e);
        // Hover only: a mouse or pen with no button down. Touch never hovers.
        if (e.pointerType !== 'touch' && e.buttons === 0) {
          onDefinitionHover?.(hitTestWord(layoutPx(e), wordTargets));
        }
      }}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={() => {
        handlers.onPointerCancel();
        onDefinitionRelease?.(null);
      }}
      className="relative w-full h-full overflow-hidden"
      style={{
        touchAction: 'none',
        overscrollBehavior: 'none',
        // U1/R5: once receded, the field must keep reading as directly
        // pressable rather than decorative background — a pointer cursor
        // (replacing the ordinary crosshair) plus a subtle inset highlight
        // on hover. Both stay inert while recedeProgress is 0 (today's rail,
        // the only state U1 ships with — U2-U5 drive it above 0).
        // U4: dropDisabled also backgrounds the pointer affordance — a
        // direct press is a deliberate no-op during the pre-mint
        // departure-float landing, so neither the crosshair cursor nor the
        // gold "clickable" hover ring should imply otherwise.
        cursor: recedeProgress > 0 || dropDisabled ? 'pointer' : isPanning ? 'grabbing' : 'crosshair',
        boxShadow: (recedeProgress > 0 || dropDisabled) && isHoveringOnly ? 'inset 0 0 0 1px var(--ui-gold-dim)' : 'none',
        transition: reducedMotion ? 'none' : 'box-shadow 0.2s ease-out',
      }}
    >
      <div ref={swellRoot} style={{ display: 'none' }} />
      {/* The night sky itself — beneath words, pins and labels (Task 7). */}
      {sky && webgl && <SkyAurora inputs={auroraInputs} invalidateRef={auroraInvalidate} reducedMotion={!!reducedMotion} onUnavailable={onAuroraUnavailable} />}
      {sky && (
        <SkyBackdrop
          proj={proj}
          size={size}
          stars={skyStars}
          constellation={constellation}
          departure={skyDeparture}
          reducedMotion={!!reducedMotion}
          paintSky={!webgl}
        />
      )}

      {/* The flat field's own layers. The night sky (skyField) draws none of
          them: the aura, the signal, the crosshairs and the radiance all
          assume a flat plane with a fixed centre. */}
      {!sky && (
        <>
          {/* Ambient watercolor aura — the deepest layer, pure background mood */}
          <FieldAura />

          {/* Light-signaling — still-center pool + outward intensity gradient,
              beneath every other layer (U4) */}
          <FieldSignal />

          {/* Crosshairs — the resting axis lines (emphasis brightens their colour). */}
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: crosshairColor, pointerEvents: 'none', zIndex: 1, transition: `background ${tuning.axisFade}s ease` }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: crosshairColor, pointerEvents: 'none', zIndex: 1, transition: `background ${tuning.axisFade}s ease` }} />

          {/* Radiating light — a soft glow pulses from the centre out to the labels
              (vertical pair first, then horizontal), drawn as an additive canvas
              trail so it reads as continuous light rather than dots. */}
          <AxisRadiance
            play={play}
            delay={tuning.axisPulseDelay}
            stagger={tuning.axisPulseStagger}
            duration={tuning.axisPulseDuration}
            strength={tuning.axisPulseStrength}
          />
        </>
      )}

      {/* Departure connector (U6/R6) — always mounted, self-gating on
          `play`, same shape as AxisRadiance above. Flat only: the sky draws
          its own on SkyBackdrop (see skyDeparture). */}
      <DepartureTrace
        play={sky ? 0 : departureTracePlay}
        from={departureTraceFrom}
        to={departureTraceTo}
        size={size}
        toPx={toFieldPx}
        travel={tuning.departureTravel}
        trail={tuning.departureTrail}
        hold={tuning.departureHold}
        fadeOut={tuning.departureFadeOut}
        strength={tuning.departureStrength}
      />

      {/* Axis labels — brighten with emphasis. */}
      <motion.div initial={{ opacity: AXIS_REST }} {...labelAnim} style={{ ...AXIS_LABEL, color: AXIS_TEXT, top: 16, left: '50%', transform: 'translateX(-50%)' }}>
        Positive
      </motion.div>
      <motion.div initial={{ opacity: AXIS_REST }} {...labelAnim} style={{ ...AXIS_LABEL, color: AXIS_TEXT, bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
        Negative
      </motion.div>
      <motion.div initial={{ opacity: AXIS_REST }} {...labelAnim} style={{ ...AXIS_LABEL, color: AXIS_TEXT, left: 16, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>
        Calm
      </motion.div>
      <motion.div initial={{ opacity: AXIS_REST }} {...labelAnim} style={{ ...AXIS_LABEL, color: AXIS_TEXT, right: 16, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }}>
        Activated
      </motion.div>

      {/* Axis position indicators — visible only while dragging. Flat only:
          in the sky the edges no longer map linearly to a coordinate. */}
      {!sky && isRevealed && revealCenter && (
        <>
          {/* Arousal: slides left–right along the bottom edge */}
          <div style={{
            position: 'absolute',
            left: `${toPercent(revealCenter.x)}%`,
            bottom: 6,
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgb(var(--ui-gold-rgb) / 0.55)',
            pointerEvents: 'none',
            zIndex: 6,
          }} />
          {/* Valence: slides up–down along the right edge */}
          <div style={{
            position: 'absolute',
            top: `${toPercent(-revealCenter.y)}%`,
            right: 6,
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgb(var(--ui-gold-rgb) / 0.55)',
            pointerEvents: 'none',
            zIndex: 6,
          }} />
        </>
      )}

      {size.width > 0 && (
        <>
          {/* Word tethers — beneath the labels, above the crosshairs: a hairline
              from each displaced label back to its dot. */}
          {/* All tethers draw-then-fade when tethers are on; the pair's two
              always persist (warmed to gold), so even with tethers globally off
              the two named feelings stay linked to their true coordinates. */}
          <WordTethers
            segments={tuning.showTethers ? wordTethers : wordTethers.filter((s) => pairIds.has(s.id))}
            duration={tuning.tetherDuration}
            keep={tuning.keepTethers}
            keepIds={pairIds}
          />

          {/* Surface emotions — always ambient at low opacity, brighten near cursor.
              Each sits in a zero-size wrapper that usePinLanding leans toward a
              landing pin, clear of the transforms framer drives inside. */}
          {surfaceEmotions.map((emotion) => {
            const at = proj.toPx(emotion);
            if (!at.visible) return null;
            return (
              <div key={emotion.id} data-lean-word={emotion.id} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
                <EmotionWord
                  emotion={emotion}
                  proximity={proximity.get(emotion.id)!}
                  isSelected={selectedIds.has(emotion.id)}
                  isHighlighted={highlightedIds.has(emotion.id)}
                  x={at.x}
                  y={at.y}
                  hideDot={sky}
                  emphasis={pairIds.has(emotion.id) ? 'pair' : null}
                  tagPulse={tagPulse?.id === emotion.id ? tagPulse : null}
                />
              </div>
            );
          })}

          {/* Deep emotions — revealed near dwell/pins; fade in on mount, out on unmount */}
          <AnimatePresence>
            {revealedDeep.map(e => {
                const isFixed = selectedIds.has(e.id) || highlightedIds.has(e.id);
                const pinOpacity = deepOpacityMap.get(e.id) ?? 0;
                const dwell = dwellOpacityMap.get(e.id);
                const dwellOpacity = dwell?.opacity ?? 0;
                const opacity = isFixed ? 1 : Math.max(dwellOpacity, pinOpacity);
                const enterDelay = !isFixed && dwell ? dwell.rank * 0.08 : 0;
                // Reveal drives opacity; the live cursor drives size + colour.
                const live = deepProximity.get(e.id);
                return (
                  <EmotionWord
                    key={e.id}
                    emotion={e}
                    proximity={{ opacity, scale: live?.scale ?? 1, isCandidate: false, nearness: live?.nearness ?? 0 }}
                    isSelected={selectedIds.has(e.id)}
                    isHighlighted={highlightedIds.has(e.id)}
                    pos={deepPos.get(e.id)!}
                    hideDot={sky}
                    enterDelay={enterDelay}
                    animateIn
                    offset={deepLabelOffsets.get(e.id)}
                    emphasis={pairIds.has(e.id) ? 'pair' : recedeActive ? 'recede' : null}
                    recedeStrength={tuning.recedeStrength}
                    tagPulse={tagPulse?.id === e.id ? tagPulse : null}
                  />
                );
              })}
          </AnimatePresence>

          {pins.map((pin) => {
            const { x: px, y: py, visible } = proj.toPx(pin);
            if (!visible) return null;
            const isEmphasized = pin.id === emphasizedPinId;
            const dotSize = isEmphasized ? 7 : 4;
            return (
              <div
                key={pin.id}
                data-field-pin={pin.id}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  pointerEvents: 'none',
                  zIndex: 10,
                  width: 0,
                  height: 0,
                }}
              >
                {/* Landing rings — two thin rings usePinLanding spreads from
                    the pin on each plant or move. Outside the body, so on a
                    move they bloom at the destination. At rest: invisible. */}
                {[0, 1].map((k) => (
                  <div
                    key={k}
                    data-pin-ring
                    style={{
                      position: 'absolute',
                      width: PIN_RING_SIZE,
                      height: PIN_RING_SIZE,
                      top: -PIN_RING_SIZE / 2,
                      left: -PIN_RING_SIZE / 2,
                      borderRadius: '50%',
                      border: '1px solid var(--ui-gold)',
                      opacity: 0,
                    }}
                  />
                ))}
                {/* Body — usePinLanding springs it over from the old spot when
                    the pin moves; everything the pin *is* rides inside it. */}
                <div data-pin-body style={{ position: 'absolute', left: 0, top: 0 }}>
                  {/* Emphasis pulse — two staggered sonar rings on the selected
                      pin, echoing the replay's expanding ring pulses */}
                  {isEmphasized &&
                    [0, 1.1].map((delay, k) => (
                      <motion.div
                        key={k}
                        initial={{ scale: 0.7, opacity: 0.5 }}
                        animate={{ scale: 3.4, opacity: 0 }}
                        transition={{ duration: 1.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.3, delay }}
                        style={{
                          position: 'absolute',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          border: '1px solid rgb(var(--ui-gold-rgb) / 0.6)',
                          top: -6,
                          left: -6,
                        }}
                      />
                    ))}
                  {/* Dot — larger and brighter when its card is selected;
                      usePinLanding settles it in on a spring when planted */}
                  <div
                    data-pin-dot
                    style={{
                      position: 'absolute',
                      width: dotSize,
                      height: dotSize,
                      borderRadius: '50%',
                      background: isEmphasized ? 'rgb(var(--ui-gold-rgb) / 1)' : 'rgb(var(--ui-gold-rgb) / 0.7)',
                      boxShadow: isEmphasized ? '0 0 8px 1px rgb(var(--ui-gold-rgb) / 0.7)' : 'none',
                      top: -dotSize / 2,
                      left: -dotSize / 2,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {/* Live-drag glow — the one mechanism for both slider-driven drags
              this field reacts to: a soft marker at the live coordinate
              while a DepartureFloat slider (pre-mint) or an ordinary
              adjust-slider (post-mint, on an already-selected pin) is
              dragged. Replaces two previously-separate treatments — this
              same glow for departureDraft, plus a travel line/origin
              ring/dashed ghost line for adjustDraft — with one: liveDraft
              is never both at once (see its own declaration), so one
              marker, keyed to liveDraftAccent's hue, covers either case.
              No travel line, no origin ring for the adjust case either
              now — the glow's own motion already reads as movement.
              The marker glides after the draft rather than snapping to
              it (LiveDraftGlow); the release's rings come from the pin
              landing's move (usePinLanding). */}
          <LiveDraftGlow
            target={liveDraft ? toFieldPx(liveDraft) : null}
            accent={liveDraftAccent}
            reducedMotion={!!reducedMotion}
          />

          {/* Recorded pins — the previous check-in's pins (R10), quieter and
              in a distinct cool hue from the draft's warm gold (R11), so the
              two groups read apart without opening a card. Not gated on the
              draft's state: these persist alongside a live draft, which is
              the point of this unit. No mount pulse-ring — these were never
              "just dropped" in this session. The hue survives emphasis: a
              selected recorded pin brightens within --ui-recorded rather
              than switching to gold, so the distinction holds through
              selection too. zIndex 9, one below the draft dots' 10, so a
              draft pin dropped on top of a recorded one reads as the live
              one on top.

              U4/R5: the anchor — the check-in's newest pin, matching
              departureAnchor's own fallback (src/data/departure.ts), so this
              mark and the departure card can't disagree about which pin is
              the anchor (LC2) — renders as a hollow ring instead of a filled
              dot, carrying the relative-day label. It reads as settled
              history and as unmistakably *another check-in*, not a quieter
              copy of today's. Non-anchor pins in a multi-pin check-in keep
              the filled-dot treatment (LC3) and their own breathing halo
              unchanged, below. */}
          {recordedPins.map((pin, i) => {
            const { x: px, y: py, visible } = proj.toPx(pin);
            if (!visible) return null;
            const isEmphasized = pin.id === emphasizedPinId;
            const isAnchor = i === recordedPins.length - 1;

            if (isAnchor) {
              // The mark *is* the breathing ring — folded into one element so
              // a hollow ring plus a separate halo never stack into two
              // concentric rings (the noise this unit exists to avoid).
              // Breathing lives in opacity only; the ring never changes size
              // on its own, so its position and radius stay a stable target
              // to depart from mid-drag.
              const ringSize = isEmphasized ? ANCHOR_RING_SIZE.emphasized : ANCHOR_RING_SIZE.rest;
              return (
                <div
                  key={pin.id}
                  style={{
                    position: 'absolute',
                    left: px,
                    top: py,
                    pointerEvents: 'none',
                    zIndex: 9,
                    width: 0,
                    height: 0,
                  }}
                >
                  {isEmphasized &&
                    [0, 1.1].map((delay, k) => (
                      <motion.div
                        key={k}
                        initial={{ scale: 0.7, opacity: 0.45 }}
                        animate={{ scale: 3.4, opacity: 0 }}
                        transition={{ duration: 1.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.3, delay }}
                        style={{
                          position: 'absolute',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          border: '1px solid var(--ui-recorded-dim)',
                          top: -6,
                          left: -6,
                        }}
                      />
                    ))}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={
                      reducedMotion
                        ? { opacity: isEmphasized ? 0.95 : 0.7 }
                        : { opacity: isEmphasized ? [0.75, 1, 0.75] : [0.55, 0.85, 0.55] }
                    }
                    transition={
                      reducedMotion
                        ? { duration: 0.3 }
                        : { duration: 3.2, ease: 'easeInOut', repeat: Infinity }
                    }
                    style={{
                      position: 'absolute',
                      width: ringSize,
                      height: ringSize,
                      marginLeft: -ringSize / 2,
                      marginTop: -ringSize / 2,
                      borderRadius: '50%',
                      border: `1.5px solid var(--ui-recorded)`,
                      boxShadow: isEmphasized ? '0 0 8px 1px var(--ui-recorded-dim)' : 'none',
                    }}
                  />
                  {/* Day label — above the ring by default, moved to a clear
                      side when a surface word sits there (anchorMark). */}
                  {previousCheckInLabel && anchorMark?.label && (
                    <span
                      style={{
                        position: 'absolute',
                        left: anchorMark.label.dx,
                        top: anchorMark.label.dy,
                        transform: 'translate(-50%, -50%)',
                        lineHeight: `${ANCHOR_LABEL_H}px`,
                        fontSize: 8,
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--ui-recorded)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {previousCheckInLabel}
                    </span>
                  )}
                </div>
              );
            }

            const dotSize = isEmphasized ? 7 : 4;
            return (
              <div
                key={pin.id}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  pointerEvents: 'none',
                  zIndex: 9,
                  width: 0,
                  height: 0,
                }}
              >
                {/* Soft breathing halo — quiet ambient presence, not a
                    one-shot mount pulse */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0.2 }}
                  animate={
                    reducedMotion
                      ? { scale: 1, opacity: 0.12 }
                      : { scale: [0.8, 1.25, 0.8], opacity: [0.2, 0.06, 0.2] }
                  }
                  transition={
                    reducedMotion
                      ? { duration: 0.3 }
                      : { duration: 3.2, ease: 'easeInOut', repeat: Infinity }
                  }
                  style={{
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '1px solid var(--ui-recorded-dim)',
                    top: -5,
                    left: -5,
                  }}
                />
                {/* Emphasis pulse — same two-ring sonar shape as the draft
                    block, recolored to the recorded hue so selection reads
                    without borrowing gold */}
                {isEmphasized &&
                  [0, 1.1].map((delay, k) => (
                    <motion.div
                      key={k}
                      initial={{ scale: 0.7, opacity: 0.45 }}
                      animate={{ scale: 3.4, opacity: 0 }}
                      transition={{ duration: 1.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.3, delay }}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: '1px solid var(--ui-recorded-dim)',
                        top: -6,
                        left: -6,
                      }}
                    />
                  ))}
                {/* Dot — below the draft pins' base opacity at rest;
                    brightens on emphasis while staying in the recorded hue */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  style={{
                    position: 'absolute',
                    width: dotSize,
                    height: dotSize,
                    borderRadius: '50%',
                    background: isEmphasized ? 'var(--ui-recorded)' : 'var(--ui-recorded-dim)',
                    boxShadow: isEmphasized ? '0 0 8px 1px var(--ui-recorded-dim)' : 'none',
                    top: -dotSize / 2,
                    left: -dotSize / 2,
                  }}
                />
              </div>
            );
          })}

          {/* The definition tooltip (word-definition-tooltips). One constant
              key: a new word re-targets the same card; a fresh open draws the
              tether again. */}
          <AnimatePresence>
            {definitionEmotion && definitionStar && definitionStarShown && (
              <DefinitionTip
                key="definition-tip"
                emotion={definitionEmotion}
                star={{ x: definitionStar.x, y: definitionStar.y }}
                layout={definitionLayout}
                obstacles={definitionObstacles}
                bounds={definitionBounds}
                onDismiss={onDefinitionDismiss}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
