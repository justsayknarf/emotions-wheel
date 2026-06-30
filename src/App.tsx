import { useState, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EmotionField } from './components/EmotionField/EmotionField';
import { EmotionDrawer } from './components/EmotionPreview/EmotionDrawer';
import { DefinitionCardSequence } from './components/DefinitionCard/DefinitionCardSequence';
import { SessionComplete } from './components/SessionComplete';
import { DiaryHistory } from './components/DiaryHistory/DiaryHistory';
import { useDiary } from './hooks/useDiary';
import type { AppView, SelectedEmotion, DiaryEntry } from './types';

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
  const [selectedEmotions, setSelectedEmotions] = useState<SelectedEmotion[]>([]);
  const [markerCoords, setMarkerCoords] = useState<Array<{ x: number; y: number }>>([]);
  const [lastEntry, setLastEntry] = useState<DiaryEntry | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const { entries, record } = useDiary();
  const { showHint, hasInteracted, markInteracted } = useOnboarding();

  const handleRecord = useCallback(() => {
    const entry = record(selectedEmotions, sessionStartRef.current);
    setLastEntry(entry);
    setView('complete');
  }, [selectedEmotions, record]);

  const handleDone = useCallback(() => {
    if (selectedEmotions.length > 0) handleRecord();
  }, [selectedEmotions, handleRecord]);

  const handleMarkerAdd = useCallback((coord: { x: number; y: number }) => {
    setMarkerCoords(prev => [...prev, coord]);
  }, []);

  const handleNewSession = useCallback(() => {
    setSelectedEmotions([]);
    setMarkerCoords([]);
    setLastEntry(null);
    sessionStartRef.current = Date.now();
    setView('field');
  }, []);

  const handleFirstInteraction = useCallback(() => {
    markInteracted();
    sessionStartRef.current = Date.now();
  }, [markInteracted]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#111111' }}>
      {/* EmotionField always mounted — single instance, no gesture state issues */}
      <EmotionField
        selectedEmotions={selectedEmotions}
        onSelectionChange={setSelectedEmotions}
        onFirstInteraction={handleFirstInteraction}
        hasInteracted={hasInteracted}
        markerCoords={markerCoords}
        onMarkerAdd={handleMarkerAdd}
      />

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
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 30,
                }}
              >
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    fontSize: 14,
                    color: 'rgba(232, 224, 216, 0.85)',
                    background: 'rgba(30, 26, 22, 0.85)',
                    padding: '10px 20px',
                    borderRadius: 20,
                    backdropFilter: 'blur(8px)',
                    margin: 0,
                    letterSpacing: '0.02em',
                    border: '1px solid rgba(232, 224, 216, 0.12)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  press near a word to reveal and select it
                </motion.p>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {selectedEmotions.length > 0 && (
              <EmotionDrawer
                selectedEmotions={selectedEmotions}
                onDeselect={(id) => setSelectedEmotions(prev => prev.filter(e => e.id !== id))}
                onDone={handleDone}
                onClear={() => setSelectedEmotions([])}
              />
            )}
          </AnimatePresence>

          {entries.length > 0 && (
            <button
              onClick={() => setView('history')}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'rgba(30, 26, 22, 0.7)',
                border: '1px solid rgba(232, 224, 216, 0.15)',
                borderRadius: 12,
                padding: '8px 12px',
                color: 'rgba(232, 224, 216, 0.5)',
                fontSize: 12,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                zIndex: 20,
                letterSpacing: '0.02em',
              }}
            >
              history
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
            style={{ position: 'absolute', inset: 0 }}
          >
            <DefinitionCardSequence
              selectedEmotions={selectedEmotions}
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
            style={{ position: 'absolute', inset: 0 }}
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
            style={{ position: 'absolute', inset: 0 }}
          >
            <DiaryHistory
              entries={entries}
              onBack={() => setView('field')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
