import type { EmotionDepth } from '../data/emotions';

export interface AdminEmotion {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: EmotionDepth;
  cluster: string;
  description: string;
  relatedIds: string[];
}
