import { motion } from 'framer-motion';

interface Props {
  x: number; // pixel x on screen
  y: number; // pixel y on screen
}

export function Pin({ x, y }: Props) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(251, 191, 36, 0.9)',
          boxShadow: '0 0 0 3px rgba(251, 191, 36, 0.3), 0 0 20px rgba(251, 191, 36, 0.2)',
        }}
      />
    </motion.div>
  );
}
