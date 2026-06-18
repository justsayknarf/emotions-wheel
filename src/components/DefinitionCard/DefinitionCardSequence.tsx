import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DefinitionCard } from './DefinitionCard';
import type { SelectedEmotion } from '../../types';

interface Props {
  selectedEmotions: SelectedEmotion[];
  onRecord: () => void;
}

export function DefinitionCardSequence({ selectedEmotions, onRecord }: Props) {
  const [index, setIndex] = useState(0);

  const handleNext = () => {
    if (index >= selectedEmotions.length - 1) {
      onRecord();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const currentEmotion = selectedEmotions[index];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 16px 48px',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(2px)',
        zIndex: 50,
      }}
    >
      <AnimatePresence mode="wait">
        <DefinitionCard
          key={currentEmotion.id}
          emotion={currentEmotion}
          index={index}
          total={selectedEmotions.length}
          onNext={handleNext}
          onSkip={onRecord}
          isLast={index === selectedEmotions.length - 1}
        />
      </AnimatePresence>
    </div>
  );
}
