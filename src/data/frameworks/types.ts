export type EmotionDepth = 'surface' | 'deep';

export interface Emotion {
  id: string;
  label: string;
  x: number;       // arousal: -1 (calm) → +1 (activated)
  y: number;       // valence: -1 (negative) → +1 (positive)
  depth: EmotionDepth;
  cluster: string;
}

// A named, hotswappable vocabulary. Each framework maps the same
// coordinate space to a different set of emotion words.
export interface Framework {
  id: string;
  name: string;
  emotions: Emotion[];
}
