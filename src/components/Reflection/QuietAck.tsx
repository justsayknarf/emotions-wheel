import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// One short line that fades in and out after a reflection action ("Okay,
// tomorrow."). Keyed by `ack.id`, so the same message twice replays.
// Neutral on purpose: no praise, no counts (frankbrain MotivationModel).
export function QuietAck({ ack }: { ack: { id: number; text: string } | null }) {
  // Which ack has finished showing. Set from the timer, never in the effect
  // body, so a new ack shows on the render it arrives in.
  const [doneId, setDoneId] = useState<number | null>(null);

  useEffect(() => {
    if (!ack) return;
    const t = window.setTimeout(() => setDoneId(ack.id), 2600);
    return () => window.clearTimeout(t);
  }, [ack]);

  const visible = ack && ack.id !== doneId ? ack : null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 40 }}
    >
      <AnimatePresence>
        {visible && (
          <motion.span
            key={visible.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              background: 'rgb(var(--ui-surface-rgb) / 0.85)',
              border: '1px solid var(--ui-border)',
              backdropFilter: 'blur(12px)',
              fontSize: 12,
              color: 'var(--ui-text-2)',
            }}
          >
            {visible.text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
