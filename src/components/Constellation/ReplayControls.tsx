import type { RefObject } from 'react';
import { SCRUB_STEPS } from './useReplayScrub';

interface Props {
  playing: boolean;
  ended: boolean;
  scrubRef: RefObject<HTMLInputElement | null>;
  onToggle: () => void;
  /** 0..1 along the timeline; seeking pauses it. */
  onSeek: (progress: number) => void;
}

// The replay's scrubber with play/pause/replay beside it, shared by the flat
// replay (DrawnConstellation) and the sky's (SkyReplay). The input is
// uncontrolled: useReplayScrub's syncScrub writes the playhead to it.
export function ReplayControls({ playing, ended, scrubRef, onToggle, onSeek }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 40,
        transform: 'translateX(-50%)',
        width: 'min(420px, calc(100% - 32px))',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '9px 16px 9px 10px',
        borderRadius: 999,
        background: 'rgb(var(--ui-surface-rgb) / 0.8)',
        border: '1px solid var(--ui-border)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
      }}
    >
      <button
        onClick={onToggle}
        aria-label={playing ? 'Pause' : ended ? 'Replay' : 'Play'}
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          padding: 0,
          border: 'none',
          borderRadius: '50%',
          background: 'rgb(var(--ui-gold-rgb) / 0.1)',
          color: 'var(--ui-gold)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <ControlIcon kind={playing ? 'pause' : ended ? 'replay' : 'play'} />
      </button>
      <input
        ref={scrubRef}
        type="range"
        className="replay-scrubber"
        min={0}
        max={SCRUB_STEPS}
        step={1}
        defaultValue={0}
        aria-label="Replay position"
        onPointerDown={() => onSeek(Number(scrubRef.current?.value ?? 0) / SCRUB_STEPS)}
        onInput={(e) => onSeek(Number(e.currentTarget.value) / SCRUB_STEPS)}
      />
    </div>
  );
}

function ControlIcon({ kind }: { kind: 'play' | 'pause' | 'replay' }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block' }}>
      {kind === 'play' && <path d="M3.5 2.2 L10 6 L3.5 9.8 Z" fill="currentColor" />}
      {kind === 'pause' && (
        <>
          <rect x={3} y={2.5} width={2} height={7} rx={0.6} fill="currentColor" />
          <rect x={7} y={2.5} width={2} height={7} rx={0.6} fill="currentColor" />
        </>
      )}
      {kind === 'replay' && (
        <>
          <path d="M9.6 6 A3.6 3.6 0 1 1 8.5 3.4" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
          <path d="M9.2 1.4 L9.2 4 L6.6 4" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
