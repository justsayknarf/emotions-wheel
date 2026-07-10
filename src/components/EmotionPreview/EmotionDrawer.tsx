import { motion, AnimatePresence } from 'framer-motion';
import { CoordinateCard } from './CoordinateCard';
import type { PinEntry } from '../../types';

// Shared so App can size the field plane to `calc(100% - RAIL_WIDTH)` and keep
// the two planes flush at any width.
export const RAIL_WIDTH = 'clamp(340px, 32%, 420px)';

type Variant = 'sheet' | 'rail';

interface Props {
  pins: PinEntry[];
  highlightedIds: Set<string>;
  variant: Variant;
  onRecognize: (emotionId: string) => void;
  onDerecognize: (emotionId: string) => void;
  onPinRemove: (pinId: string) => void;
  onDone: () => void;
  onClear: () => void;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  // The just-dropped pin, still animating in — its card holds off the selected
  // highlight until it settles, so selection eases in rather than popping.
  enteringPinId: string | null;
  // The rail's scroll container, so the tether can find the selected card by
  // data-pin-id and track it through scroll.
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export function EmotionDrawer({
  pins,
  highlightedIds,
  variant,
  onRecognize,
  onDerecognize,
  onPinRemove,
  onDone,
  onClear,
  selectedPinId,
  onSelectPin,
  enteringPinId,
  scrollRef,
}: Props) {
  const reversedPins = [...pins].reverse();
  const isRail = variant === 'rail';

  const actionBar = (
    <div
      style={{
        padding: '11px 16px',
        borderBottom: isRail ? 'none' : '1px solid var(--oura-border)',
        borderTop: isRail ? '1px solid var(--oura-border)' : 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: '1px solid var(--oura-border)',
          borderRadius: 6,
          padding: '7px 14px',
          color: 'var(--oura-text-2)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
      <button
        onClick={onDone}
        style={{
          background: 'var(--oura-gold)',
          border: 'none',
          borderRadius: 6,
          padding: '7px 18px',
          color: '#0D0F14',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        {`Save  ·  ${pins.length}`}
      </button>
    </div>
  );

  const cardList = (
    <div
      ref={scrollRef}
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        flex: 1,
        padding: '8px 16px',
        paddingBottom: isRail ? 8 : 'max(16px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {isRail && (
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--oura-text-3)',
            padding: '6px 0 2px',
          }}
        >
          {`This session  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
        </div>
      )}
      <AnimatePresence initial={false}>
        {reversedPins.map((pin, i) => (
          <motion.div
            key={pin.id}
            layout
            data-pin-id={pin.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <CoordinateCard
              pin={pin}
              highlightedIds={i === 0 ? Array.from(highlightedIds) : []}
              isSelected={pin.id === selectedPinId}
              isEntering={pin.id === enteringPinId}
              onSelect={() => onSelectPin(pin.id)}
              onRecognize={onRecognize}
              onDerecognize={onDerecognize}
              onRemove={() => onPinRemove(pin.id)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  const shared: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(12, 14, 18, 0.97)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
  };

  if (isRail) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          ...shared,
          top: 0,
          right: 0,
          bottom: 0,
          width: RAIL_WIDTH,
          borderLeft: '1px solid var(--oura-border)',
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {cardList}
        {actionBar}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        ...shared,
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '46vh',
        borderTop: '1px solid var(--oura-border)',
        touchAction: 'pan-y',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {actionBar}
      {cardList}
    </motion.div>
  );
}
