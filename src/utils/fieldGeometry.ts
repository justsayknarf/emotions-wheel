// Maps a circumplex axis value in [-1, 1] to a field position percentage [5, 95].
// Single source of truth shared by the EmotionField, the ghost pin, the
// constellation replay, and the MiniCircumplex so every plotted point agrees.
export function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}
