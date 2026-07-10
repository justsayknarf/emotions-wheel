import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EmotionField } from './components/EmotionField/EmotionField';
import { EmotionDrawer, RAIL_WIDTH } from './components/EmotionPreview/EmotionDrawer';
import { DefinitionCardSequence } from './components/DefinitionCard/DefinitionCardSequence';
import { SessionComplete } from './components/SessionComplete';
import { DiaryHistory } from './components/DiaryHistory/DiaryHistory';
import { MirrorCard } from './components/EmotionMirror/MirrorCard';
import { FirstRunDemo } from './components/EmotionMirror/FirstRunDemo';
import { ConstellationReplay } from './components/Constellation/ConstellationReplay';
import { Tether } from './components/EmotionField/Tether';
import { useDiary } from './hooks/useDiary';
import { useSidePanelLayout } from './hooks/useSidePanelLayout';
import type { AppView, DiaryEntry, PinEntry } from './types';

const ONBOARDED_KEY = 'emotion-selector-onboarded';

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
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [lastEntry, setLastEntry] = useState<DiaryEntry | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const fieldPlaneRef = useRef<HTMLDivElement>(null);
  const [activeCardEl, setActiveCardEl] = useState<HTMLDivElement | null>(null);

  const { entries, record } = useDiary();
  const { showHint, hasInteracted, markInteracted } = useOnboarding();
  const sideBySide = useSidePanelLayout();

  // On desktop the field occupies a left plane and the tray a right rail;
  // keep the two flush by sizing the field to the remaining width.
  const fieldWidth = sideBySide ? `calc(100% - ${RAIL_WIDTH})` : '100%';
  const fieldCenterLeft = sideBySide ? `calc((100% - ${RAIL_WIDTH}) / 2)` : '50%';

  // Empty-state surface selection (all within the 'field' view):
  //   history + no pins  → returning mirror (rail card + ghost pin)
  //   no history + fresh → first-run gesture demo
  //   pins present       → active drawer (existing path)
  const hasHistory = entries.length > 0;
  const lastCoord = hasHistory ? entries[entries.length - 1].pins.at(-1) ?? null : null;
  const showMirror = view === 'field' && pins.length === 0 && hasHistory;
  const showDemo = view === 'field' && pins.length === 0 && !hasHistory && !hasInteracted;

  const handlePinRelease = useCallback((entry: PinEntry, ids: string[]) => {
    setPins((prev) => [...prev, entry]);
    setHighlightedIds(new Set(ids));
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

  const handleRecord = useCallback(() => {
    const entry = record(pins, sessionStartRef.current);
    setLastEntry(entry);
    setView('complete');
  }, [pins, record]);

  const handleDone = useCallback(() => {
    if (pins.length > 0) handleRecord();
  }, [pins, handleRecord]);

  const handleNewSession = useCallback(() => {
    setPins([]);
    setHighlightedIds(new Set());
    setLastEntry(null);
    sessionStartRef.current = Date.now();
    setView('field');
  }, []);

  const handleFirstInteraction = useCallback(() => {
    markInteracted();
    sessionStartRef.current = Date.now();
  }, [markInteracted]);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: 'var(--oura-bg)' }}
      onPointerDownCapture={(e) => {
        if (view === 'field' && entries.length > 0) {
          swipeStartRef.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onPointerMoveCapture={(e) => {
        if (!swipeStartRef.current) return;
        const dx = e.clientX - swipeStartRef.current.x;
        const dy = e.clientY - swipeStartRef.current.y;
        if (dx < -60 && Math.abs(dx) / Math.abs(dy || 1) > 2) {
          swipeStartRef.current = null;
          setView('history');
        }
      }}
      onPointerUpCapture={() => { swipeStartRef.current = null; }}
      onPointerCancelCapture={() => { swipeStartRef.current = null; }}
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
      <div ref={fieldPlaneRef} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: fieldWidth, zIndex: 2 }}>
        <EmotionField
          pins={pins}
          highlightedIds={highlightedIds}
          onPinRelease={handlePinRelease}
          onFirstInteraction={handleFirstInteraction}
          hasInteracted={hasInteracted}
          axisEmphasis={showDemo}
          ghostPin={showMirror && lastCoord ? { x: lastCoord.x, y: lastCoord.y } : null}
        />
      </div>

      {/* Field-only chrome: hint + drawer + history button */}
      {view === 'field' && (
        <>
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
                highlightedIds={highlightedIds}
                variant={sideBySide ? 'rail' : 'sheet'}
                onRecognize={handleRecognize}
                onDerecognize={handleDerecognize}
                onPinRemove={handlePinRemove}
                onDone={handleDone}
                onClear={() => { setPins([]); setHighlightedIds(new Set()); }}
                activeCardRef={sideBySide ? setActiveCardEl : undefined}
              />
            )}
          </AnimatePresence>

          {/* Pin-to-card thread — desktop only */}
          {sideBySide && pins.length > 0 && (
            <Tether pin={pins[pins.length - 1]} fieldPlaneRef={fieldPlaneRef} cardEl={activeCardEl} />
          )}

          {entries.length > 0 && (
            <button
              onClick={() => setView('history')}
              style={{
                position: 'absolute',
                top: 20,
                right: sideBySide ? `calc(${RAIL_WIDTH} + 20px)` : 20,
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
              }}
            >
              history
            </button>
          )}

          {showMirror && (
            <button
              onClick={() => setView('constellation')}
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
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
              }}
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
