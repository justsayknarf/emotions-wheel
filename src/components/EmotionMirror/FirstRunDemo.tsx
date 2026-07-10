import { motion } from 'framer-motion';
import { RAIL_WIDTH } from '../EmotionPreview/EmotionDrawer';

interface Props {
  fieldWidth: string;    // width of the field plane (rail-aware)
  variant: 'rail' | 'sheet';
}

// Target the demo gesture lands on — a point up-and-right of centre, in the
// positive/activated quadrant. Percentages are within the field plane.
const TARGET = { left: '63%', top: '40%' };
const LOOP = 4.2;
const REPEAT_DELAY = 1.4;

// Day-zero demonstration: a soft pointer drifts to a point and drops a pin that
// pulses and fades, on a gentle loop, teaching the gesture without words. The
// axes brighten via EmotionField's axisEmphasis prop, driven by App. Settles
// when the user first touches the field (App unmounts this).
export function FirstRunDemo({ fieldWidth, variant }: Props) {
  const skeleton = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--oura-text-3)' }}>
        Your check-in
      </div>
      <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'rgba(237,232,223,0.07)' }} />
      <div style={{ height: 12, width: '85%', borderRadius: 4, background: 'rgba(237,232,223,0.05)' }} />
      <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--oura-text-3)', marginTop: 2 }}>
        Your check-in will appear here
      </span>
    </div>
  );

  return (
    <>
      {/* Gesture animation over the field plane */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: fieldWidth, pointerEvents: 'none', zIndex: 12 }}>
        {/* Pointer glow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            left: ['50%', '50%', TARGET.left, TARGET.left],
            top: ['52%', '52%', TARGET.top, TARGET.top],
            opacity: [0, 0.75, 0.75, 0],
          }}
          transition={{ duration: LOOP, times: [0, 0.18, 0.58, 0.72], repeat: Infinity, repeatDelay: REPEAT_DELAY, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -8,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,124,0.55), rgba(201,168,124,0))',
          }}
        />
        {/* Demo pin ring */}
        <motion.div
          animate={{ scale: [0.4, 0.4, 1, 3.2], opacity: [0, 0, 0.6, 0] }}
          transition={{ duration: LOOP, times: [0, 0.55, 0.62, 0.85], repeat: Infinity, repeatDelay: REPEAT_DELAY, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: TARGET.left,
            top: TARGET.top,
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            borderRadius: '50%',
            border: '1px solid rgba(201,168,124,0.6)',
          }}
        />
        {/* Demo pin dot */}
        <motion.div
          animate={{ opacity: [0, 0, 0.85, 0] }}
          transition={{ duration: LOOP, times: [0, 0.58, 0.64, 0.82], repeat: Infinity, repeatDelay: REPEAT_DELAY, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: TARGET.left,
            top: TARGET.top,
            width: 4,
            height: 4,
            marginLeft: -2,
            marginTop: -2,
            borderRadius: '50%',
            background: 'rgba(201,168,124,0.85)',
          }}
        />
      </div>

      {/* Rail / sheet skeleton */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={
          variant === 'rail'
            ? { position: 'absolute', top: 0, right: 0, bottom: 0, width: RAIL_WIDTH, borderLeft: '1px solid var(--oura-border)', background: 'rgba(12,14,18,0.6)', zIndex: 15, pointerEvents: 'none' }
            : { position: 'absolute', bottom: 0, left: 0, right: 0, borderTop: '1px solid var(--oura-border)', borderRadius: '16px 16px 0 0', background: 'rgba(12,14,18,0.75)', zIndex: 15, pointerEvents: 'none', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }
        }
      >
        {skeleton}
      </motion.div>
    </>
  );
}
