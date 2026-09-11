// The one chip for an emotion word, wherever a card offers or shows one. A
// suggestion is dashed — proposed, not yet yours, the same dotted language as
// CoordinateCard's guess underline — and a named word is solid and tinted.
// Tone follows the surface the chip sits on: gold for a draft, recorded blue
// for a saved check-in (R6). Every color is mixed from the tone's own token
// so a theme swap (src/config/theme.ts) recolors the chip with it.
export type WordTagTone = 'gold' | 'recorded';

const TONES: Record<WordTagTone, { text: string; named: string; suggested: string; tint: string }> = {
  gold: {
    text: 'var(--ui-gold)',
    named: 'var(--ui-gold-dim)',
    suggested: 'color-mix(in srgb, var(--ui-gold) 32%, transparent)',
    tint: 'color-mix(in srgb, var(--ui-gold) 15%, transparent)',
  },
  recorded: {
    text: 'var(--ui-recorded)',
    named: 'var(--ui-recorded-dim)',
    suggested: 'color-mix(in srgb, var(--ui-recorded) 38%, transparent)',
    tint: 'color-mix(in srgb, var(--ui-recorded) 16%, transparent)',
  },
};

const RESET: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  font: 'inherit',
  letterSpacing: 'inherit',
  cursor: 'pointer',
};

interface Props {
  label: string;
  tone?: WordTagTone;
  named?: boolean;
  // Tapping the chip names or un-names the word. Omit for a static chip.
  onToggle?: () => void;
  // A trailing × that sets a suggestion aside without naming it.
  onDismiss?: () => void;
}

export function WordTag({ label, tone = 'gold', named = false, onToggle, onDismiss }: Props) {
  const t = TONES[tone];
  const text = label.toLowerCase();
  const bodyPadding = onDismiss ? '4px 3px 4px 11px' : '4px 11px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 6,
        border: `1px ${named ? 'solid' : 'dashed'} ${named ? t.named : t.suggested}`,
        background: named ? t.tint : 'transparent',
        color: named ? t.text : 'var(--ui-text-2)',
        fontSize: 12,
        lineHeight: 1.35,
        letterSpacing: '0.01em',
      }}
    >
      {onToggle ? (
        <button
          type="button"
          aria-pressed={named}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{ ...RESET, padding: bodyPadding }}
        >
          {text}{named ? ' ✓' : ''}
        </button>
      ) : (
        <span style={{ padding: bodyPadding }}>{text}</span>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label={`Dismiss ${text}`}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ ...RESET, padding: '4px 9px 4px 5px', color: 'var(--ui-text-3)', fontSize: 13, lineHeight: 1 }}
        >
          ×
        </button>
      )}
    </span>
  );
}
