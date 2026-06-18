export type EmotionDepth = 'surface' | 'deep';

export interface Emotion {
  id: string;
  label: string;
  x: number;       // valence: -1 (negative) → +1 (positive)
  y: number;       // arousal: -1 (calm) → +1 (activated)
  depth: EmotionDepth;
  cluster: string;
}

export const emotions: Emotion[] = [
  // ── Q1: High valence, High arousal (activated positive) ──────────────────

  // Joyful / Aliveness
  { id: 'happy',        label: 'Happy',        x:  0.65, y:  0.60, depth: 'surface', cluster: 'joyful' },
  { id: 'excited',      label: 'Excited',      x:  0.75, y:  0.80, depth: 'surface', cluster: 'joyful' },
  { id: 'enthusiastic', label: 'Enthusiastic', x:  0.65, y:  0.70, depth: 'surface', cluster: 'joyful' },
  { id: 'inspired',     label: 'Inspired',     x:  0.60, y:  0.60, depth: 'surface', cluster: 'joyful' },
  { id: 'playful',      label: 'Playful',      x:  0.55, y:  0.65, depth: 'surface', cluster: 'joyful' },
  { id: 'eager',        label: 'Eager',        x:  0.60, y:  0.75, depth: 'surface', cluster: 'joyful' },
  { id: 'amazed',       label: 'Amazed',       x:  0.50, y:  0.70, depth: 'surface', cluster: 'joyful' },
  { id: 'delighted',    label: 'Delighted',    x:  0.80, y:  0.65, depth: 'deep',    cluster: 'joyful' },
  { id: 'ecstatic',     label: 'Ecstatic',     x:  0.90, y:  0.90, depth: 'deep',    cluster: 'joyful' },
  { id: 'thrilled',     label: 'Thrilled',     x:  0.80, y:  0.85, depth: 'deep',    cluster: 'joyful' },
  { id: 'bliss',        label: 'Bliss',        x:  0.85, y:  0.45, depth: 'deep',    cluster: 'joyful' },
  { id: 'radiant',      label: 'Radiant',      x:  0.75, y:  0.55, depth: 'deep',    cluster: 'joyful' },
  { id: 'enchanted',    label: 'Enchanted',    x:  0.70, y:  0.45, depth: 'deep',    cluster: 'joyful' },
  { id: 'awe',          label: 'Awe',          x:  0.45, y:  0.55, depth: 'deep',    cluster: 'joyful' },
  { id: 'lively',       label: 'Lively',       x:  0.55, y:  0.75, depth: 'deep',    cluster: 'joyful' },
  { id: 'passionate',   label: 'Passionate',   x:  0.70, y:  0.75, depth: 'deep',    cluster: 'joyful' },
  { id: 'vibrant',      label: 'Vibrant',      x:  0.60, y:  0.80, depth: 'deep',    cluster: 'joyful' },
  { id: 'free',         label: 'Free',         x:  0.65, y:  0.50, depth: 'deep',    cluster: 'joyful' },

  // Energized
  { id: 'energized',    label: 'Energized',    x:  0.50, y:  0.85, depth: 'surface', cluster: 'energized' },
  { id: 'invigorated',  label: 'Invigorated',  x:  0.50, y:  0.80, depth: 'deep',    cluster: 'energized' },
  { id: 'refreshed',    label: 'Refreshed',    x:  0.55, y:  0.45, depth: 'deep',    cluster: 'energized' },
  { id: 'rejuvenated',  label: 'Rejuvenated',  x:  0.50, y:  0.50, depth: 'deep',    cluster: 'energized' },
  { id: 'renewed',      label: 'Renewed',      x:  0.55, y:  0.40, depth: 'deep',    cluster: 'energized' },

  // Courageous / Powerful
  { id: 'confident',    label: 'Confident',    x:  0.55, y:  0.50, depth: 'surface', cluster: 'courageous' },
  { id: 'proud',        label: 'Proud',        x:  0.60, y:  0.40, depth: 'surface', cluster: 'courageous' },
  { id: 'strong',       label: 'Strong',       x:  0.55, y:  0.55, depth: 'deep',    cluster: 'courageous' },
  { id: 'brave',        label: 'Brave',        x:  0.50, y:  0.60, depth: 'deep',    cluster: 'courageous' },
  { id: 'determined',   label: 'Determined',   x:  0.45, y:  0.65, depth: 'deep',    cluster: 'courageous' },
  { id: 'adventurous',  label: 'Adventurous',  x:  0.50, y:  0.75, depth: 'deep',    cluster: 'courageous' },
  { id: 'daring',       label: 'Daring',       x:  0.55, y:  0.70, depth: 'deep',    cluster: 'courageous' },
  { id: 'capable',      label: 'Capable',      x:  0.50, y:  0.45, depth: 'deep',    cluster: 'courageous' },
  { id: 'grounded',     label: 'Grounded',     x:  0.45, y:  0.30, depth: 'deep',    cluster: 'courageous' },
  { id: 'worthy',       label: 'Worthy',       x:  0.50, y:  0.35, depth: 'deep',    cluster: 'courageous' },
  { id: 'valiant',      label: 'Valiant',      x:  0.45, y:  0.60, depth: 'deep',    cluster: 'courageous' },

  // Curious
  { id: 'curious',      label: 'Curious',      x:  0.40, y:  0.55, depth: 'surface', cluster: 'curious' },
  { id: 'fascinated',   label: 'Fascinated',   x:  0.45, y:  0.50, depth: 'deep',    cluster: 'curious' },
  { id: 'intrigued',    label: 'Intrigued',    x:  0.40, y:  0.45, depth: 'deep',    cluster: 'curious' },
  { id: 'interested',   label: 'Interested',   x:  0.35, y:  0.40, depth: 'deep',    cluster: 'curious' },
  { id: 'engaged',      label: 'Engaged',      x:  0.45, y:  0.55, depth: 'deep',    cluster: 'curious' },
  { id: 'exploring',    label: 'Exploring',    x:  0.40, y:  0.60, depth: 'deep',    cluster: 'curious' },
  { id: 'stimulated',   label: 'Stimulated',   x:  0.45, y:  0.65, depth: 'deep',    cluster: 'curious' },
  { id: 'involved',     label: 'Involved',     x:  0.40, y:  0.50, depth: 'deep',    cluster: 'curious' },

  // ── Q2: High valence, Low arousal (calm positive) ────────────────────────

  // Peaceful / Open
  { id: 'peaceful',     label: 'Peaceful',     x:  0.65, y: -0.60, depth: 'surface', cluster: 'peaceful' },
  { id: 'calm',         label: 'Calm',         x:  0.60, y: -0.50, depth: 'surface', cluster: 'peaceful' },
  { id: 'content',      label: 'Content',      x:  0.70, y: -0.40, depth: 'surface', cluster: 'peaceful' },
  { id: 'relaxed',      label: 'Relaxed',      x:  0.55, y: -0.50, depth: 'surface', cluster: 'peaceful' },
  { id: 'serene',       label: 'Serene',       x:  0.70, y: -0.70, depth: 'deep',    cluster: 'peaceful' },
  { id: 'centered',     label: 'Centered',     x:  0.50, y: -0.45, depth: 'deep',    cluster: 'peaceful' },
  { id: 'present',      label: 'Present',      x:  0.55, y: -0.35, depth: 'deep',    cluster: 'peaceful' },
  { id: 'patient',      label: 'Patient',      x:  0.50, y: -0.55, depth: 'deep',    cluster: 'peaceful' },
  { id: 'fulfilled',    label: 'Fulfilled',    x:  0.75, y: -0.35, depth: 'deep',    cluster: 'peaceful' },
  { id: 'trusting',     label: 'Trusting',     x:  0.60, y: -0.40, depth: 'deep',    cluster: 'peaceful' },

  // Connected / Loving
  { id: 'warm',         label: 'Warm',         x:  0.65, y: -0.25, depth: 'surface', cluster: 'loving' },
  { id: 'caring',       label: 'Caring',       x:  0.60, y: -0.25, depth: 'surface', cluster: 'loving' },
  { id: 'affectionate', label: 'Affectionate', x:  0.70, y: -0.20, depth: 'deep',    cluster: 'loving' },
  { id: 'loving',       label: 'Loving',       x:  0.75, y: -0.20, depth: 'deep',    cluster: 'loving' },
  { id: 'compassion',   label: 'Compassion',   x:  0.65, y: -0.30, depth: 'deep',    cluster: 'loving' },
  { id: 'empathy',      label: 'Empathy',      x:  0.60, y: -0.35, depth: 'deep',    cluster: 'loving' },
  { id: 'safe',         label: 'Safe',         x:  0.70, y: -0.45, depth: 'deep',    cluster: 'loving' },
  { id: 'accepting',    label: 'Accepting',    x:  0.55, y: -0.30, depth: 'deep',    cluster: 'loving' },
  { id: 'self-loving',  label: 'Self-loving',  x:  0.65, y: -0.25, depth: 'deep',    cluster: 'loving' },
  { id: 'vulnerable',   label: 'Vulnerable',   x:  0.45, y: -0.30, depth: 'deep',    cluster: 'loving' },
  { id: 'reflective',   label: 'Reflective',   x:  0.40, y: -0.40, depth: 'deep',    cluster: 'loving' },

  // Grateful
  { id: 'grateful',     label: 'Grateful',     x:  0.70, y: -0.30, depth: 'surface', cluster: 'grateful' },
  { id: 'thankful',     label: 'Thankful',     x:  0.75, y: -0.35, depth: 'deep',    cluster: 'grateful' },
  { id: 'appreciative', label: 'Appreciative', x:  0.70, y: -0.25, depth: 'deep',    cluster: 'grateful' },
  { id: 'blessed',      label: 'Blessed',      x:  0.75, y: -0.45, depth: 'deep',    cluster: 'grateful' },
  { id: 'moved',        label: 'Moved',        x:  0.60, y: -0.20, depth: 'deep',    cluster: 'grateful' },
  { id: 'humbled',      label: 'Humbled',      x:  0.55, y: -0.30, depth: 'deep',    cluster: 'grateful' },
  { id: 'touched',      label: 'Touched',      x:  0.65, y: -0.20, depth: 'deep',    cluster: 'grateful' },
  { id: 'fortunate',    label: 'Fortunate',    x:  0.70, y: -0.40, depth: 'deep',    cluster: 'grateful' },
  { id: 'grace',        label: 'Grace',        x:  0.60, y: -0.50, depth: 'deep',    cluster: 'grateful' },

  // Hopeful
  { id: 'hopeful',      label: 'Hopeful',      x:  0.55, y: -0.20, depth: 'surface', cluster: 'hopeful' },
  { id: 'optimistic',   label: 'Optimistic',   x:  0.60, y: -0.15, depth: 'deep',    cluster: 'hopeful' },
  { id: 'encouraged',   label: 'Encouraged',   x:  0.55, y: -0.25, depth: 'deep',    cluster: 'hopeful' },
  { id: 'expectant',    label: 'Expectant',    x:  0.50, y: -0.15, depth: 'deep',    cluster: 'hopeful' },

  // ── Q3: Low valence, High arousal (activated negative) ───────────────────

  // Angry / Annoyed
  { id: 'angry',        label: 'Angry',        x: -0.65, y:  0.70, depth: 'surface', cluster: 'angry' },
  { id: 'frustrated',   label: 'Frustrated',   x: -0.60, y:  0.65, depth: 'surface', cluster: 'angry' },
  { id: 'irritated',    label: 'Irritated',    x: -0.55, y:  0.60, depth: 'surface', cluster: 'angry' },
  { id: 'upset',        label: 'Upset',        x: -0.55, y:  0.65, depth: 'surface', cluster: 'angry' },
  { id: 'furious',      label: 'Furious',      x: -0.80, y:  0.90, depth: 'deep',    cluster: 'angry' },
  { id: 'outraged',     label: 'Outraged',     x: -0.75, y:  0.85, depth: 'deep',    cluster: 'angry' },
  { id: 'agitated',     label: 'Agitated',     x: -0.60, y:  0.75, depth: 'deep',    cluster: 'angry' },
  { id: 'aggravated',   label: 'Aggravated',   x: -0.60, y:  0.70, depth: 'deep',    cluster: 'angry' },
  { id: 'exasperated',  label: 'Exasperated',  x: -0.65, y:  0.65, depth: 'deep',    cluster: 'angry' },
  { id: 'hostile',      label: 'Hostile',      x: -0.70, y:  0.75, depth: 'deep',    cluster: 'angry' },
  { id: 'irate',        label: 'Irate',        x: -0.75, y:  0.80, depth: 'deep',    cluster: 'angry' },
  { id: 'pissed',       label: 'Pissed',       x: -0.75, y:  0.75, depth: 'deep',    cluster: 'angry' },
  { id: 'resentful',    label: 'Resentful',    x: -0.70, y:  0.55, depth: 'deep',    cluster: 'angry' },
  { id: 'bitter',       label: 'Bitter',       x: -0.65, y:  0.50, depth: 'deep',    cluster: 'angry' },
  { id: 'contempt',     label: 'Contempt',     x: -0.70, y:  0.45, depth: 'deep',    cluster: 'angry' },
  { id: 'disdain',      label: 'Disdain',      x: -0.65, y:  0.40, depth: 'deep',    cluster: 'angry' },
  { id: 'cynical',      label: 'Cynical',      x: -0.60, y:  0.40, depth: 'deep',    cluster: 'angry' },
  { id: 'vindictive',   label: 'Vindictive',   x: -0.75, y:  0.60, depth: 'deep',    cluster: 'angry' },
  { id: 'disgruntled',  label: 'Disgruntled',  x: -0.55, y:  0.55, depth: 'deep',    cluster: 'angry' },
  { id: 'grouchy',      label: 'Grouchy',      x: -0.50, y:  0.50, depth: 'deep',    cluster: 'angry' },
  { id: 'moody',        label: 'Moody',        x: -0.45, y:  0.45, depth: 'deep',    cluster: 'angry' },
  { id: 'impatient',    label: 'Impatient',    x: -0.50, y:  0.60, depth: 'deep',    cluster: 'angry' },
  { id: 'disturbed',    label: 'Disturbed',    x: -0.55, y:  0.70, depth: 'deep',    cluster: 'angry' },
  { id: 'edgy',         label: 'Edgy',         x: -0.50, y:  0.65, depth: 'deep',    cluster: 'angry' },

  // Stressed / Tense
  { id: 'stressed',     label: 'Stressed',     x: -0.50, y:  0.75, depth: 'surface', cluster: 'stressed' },
  { id: 'overwhelmed',  label: 'Overwhelmed',  x: -0.55, y:  0.80, depth: 'surface', cluster: 'stressed' },
  { id: 'burned-out',   label: 'Burned out',   x: -0.60, y:  0.70, depth: 'deep',    cluster: 'stressed' },
  { id: 'frazzled',     label: 'Frazzled',     x: -0.60, y:  0.80, depth: 'deep',    cluster: 'stressed' },
  { id: 'depleted',     label: 'Depleted',     x: -0.55, y:  0.65, depth: 'deep',    cluster: 'stressed' },
  { id: 'weary',        label: 'Weary',        x: -0.50, y:  0.60, depth: 'deep',    cluster: 'stressed' },
  { id: 'worn-out',     label: 'Worn out',     x: -0.55, y:  0.55, depth: 'deep',    cluster: 'stressed' },
  { id: 'restless',     label: 'Restless',     x: -0.45, y:  0.65, depth: 'deep',    cluster: 'stressed' },
  { id: 'rattled',      label: 'Rattled',      x: -0.55, y:  0.75, depth: 'deep',    cluster: 'stressed' },
  { id: 'shaken',       label: 'Shaken',       x: -0.60, y:  0.65, depth: 'deep',    cluster: 'stressed' },
  { id: 'tight',        label: 'Tight',        x: -0.50, y:  0.70, depth: 'deep',    cluster: 'stressed' },
  { id: 'cranky',       label: 'Cranky',       x: -0.50, y:  0.55, depth: 'deep',    cluster: 'stressed' },
  { id: 'on-edge',      label: 'On edge',      x: -0.50, y:  0.70, depth: 'deep',    cluster: 'stressed' },

  // Fear
  { id: 'afraid',       label: 'Afraid',       x: -0.65, y:  0.70, depth: 'surface', cluster: 'fear' },
  { id: 'scared',       label: 'Scared',       x: -0.65, y:  0.75, depth: 'surface', cluster: 'fear' },
  { id: 'nervous',      label: 'Nervous',      x: -0.50, y:  0.55, depth: 'surface', cluster: 'fear' },
  { id: 'anxious',      label: 'Anxious',      x: -0.55, y:  0.70, depth: 'surface', cluster: 'fear' },
  { id: 'worried',      label: 'Worried',      x: -0.50, y:  0.50, depth: 'surface', cluster: 'fear' },
  { id: 'terrified',    label: 'Terrified',    x: -0.85, y:  0.90, depth: 'deep',    cluster: 'fear' },
  { id: 'panic',        label: 'Panic',        x: -0.80, y:  0.90, depth: 'deep',    cluster: 'fear' },
  { id: 'frightened',   label: 'Frightened',   x: -0.75, y:  0.80, depth: 'deep',    cluster: 'fear' },
  { id: 'apprehensive', label: 'Apprehensive', x: -0.45, y:  0.50, depth: 'deep',    cluster: 'fear' },
  { id: 'hesitant',     label: 'Hesitant',     x: -0.40, y:  0.40, depth: 'deep',    cluster: 'fear' },
  { id: 'paralyzed',    label: 'Paralyzed',    x: -0.70, y:  0.60, depth: 'deep',    cluster: 'fear' },

  // Unsettled / Doubt
  { id: 'confused',     label: 'Confused',     x: -0.40, y:  0.50, depth: 'surface', cluster: 'unsettled' },
  { id: 'unsure',       label: 'Unsure',       x: -0.40, y:  0.35, depth: 'deep',    cluster: 'unsettled' },
  { id: 'skeptical',    label: 'Skeptical',    x: -0.45, y:  0.40, depth: 'deep',    cluster: 'unsettled' },
  { id: 'suspicious',   label: 'Suspicious',   x: -0.50, y:  0.45, depth: 'deep',    cluster: 'unsettled' },
  { id: 'concerned',    label: 'Concerned',    x: -0.45, y:  0.45, depth: 'deep',    cluster: 'unsettled' },
  { id: 'dissatisfied', label: 'Dissatisfied', x: -0.50, y:  0.35, depth: 'deep',    cluster: 'unsettled' },
  { id: 'perplexed',    label: 'Perplexed',    x: -0.40, y:  0.50, depth: 'deep',    cluster: 'unsettled' },
  { id: 'questioning',  label: 'Questioning',  x: -0.35, y:  0.40, depth: 'deep',    cluster: 'unsettled' },
  { id: 'reluctant',    label: 'Reluctant',    x: -0.40, y:  0.35, depth: 'deep',    cluster: 'unsettled' },
  { id: 'shocked',      label: 'Shocked',      x: -0.55, y:  0.75, depth: 'deep',    cluster: 'unsettled' },
  { id: 'ungrounded',   label: 'Ungrounded',   x: -0.45, y:  0.50, depth: 'deep',    cluster: 'unsettled' },
  { id: 'rejecting',    label: 'Rejecting',    x: -0.55, y:  0.55, depth: 'deep',    cluster: 'unsettled' },

  // ── Q4: Low valence, Low arousal (withdrawn negative) ────────────────────

  // Sad / Despair
  { id: 'sad',          label: 'Sad',          x: -0.60, y: -0.50, depth: 'surface', cluster: 'sad' },
  { id: 'lonely',       label: 'Lonely',       x: -0.65, y: -0.40, depth: 'surface', cluster: 'sad' },
  { id: 'grief',        label: 'Grief',        x: -0.70, y: -0.60, depth: 'surface', cluster: 'sad' },
  { id: 'disappointed', label: 'Disappointed', x: -0.60, y: -0.45, depth: 'deep',    cluster: 'sad' },
  { id: 'discouraged',  label: 'Discouraged',  x: -0.60, y: -0.50, depth: 'deep',    cluster: 'sad' },
  { id: 'unhappy',      label: 'Unhappy',      x: -0.60, y: -0.40, depth: 'deep',    cluster: 'sad' },
  { id: 'melancholy',   label: 'Melancholy',   x: -0.65, y: -0.55, depth: 'deep',    cluster: 'sad' },
  { id: 'depressed',    label: 'Depressed',    x: -0.75, y: -0.70, depth: 'deep',    cluster: 'sad' },
  { id: 'hopeless',     label: 'Hopeless',     x: -0.75, y: -0.60, depth: 'deep',    cluster: 'sad' },
  { id: 'heartbroken',  label: 'Heartbroken',  x: -0.80, y: -0.55, depth: 'deep',    cluster: 'sad' },
  { id: 'despondent',   label: 'Despondent',   x: -0.75, y: -0.65, depth: 'deep',    cluster: 'sad' },
  { id: 'forlorn',      label: 'Forlorn',      x: -0.70, y: -0.60, depth: 'deep',    cluster: 'sad' },
  { id: 'gloomy',       label: 'Gloomy',       x: -0.65, y: -0.55, depth: 'deep',    cluster: 'sad' },
  { id: 'sorrow',       label: 'Sorrow',       x: -0.70, y: -0.55, depth: 'deep',    cluster: 'sad' },
  { id: 'teary',        label: 'Teary',        x: -0.55, y: -0.45, depth: 'deep',    cluster: 'sad' },
  { id: 'anguish',      label: 'Anguish',      x: -0.80, y: -0.65, depth: 'deep',    cluster: 'sad' },
  { id: 'longing',      label: 'Longing',      x: -0.65, y: -0.40, depth: 'deep',    cluster: 'sad' },
  { id: 'yearning',     label: 'Yearning',     x: -0.60, y: -0.35, depth: 'deep',    cluster: 'sad' },

  // Disconnected / Numb
  { id: 'numb',         label: 'Numb',         x: -0.55, y: -0.70, depth: 'surface', cluster: 'numb' },
  { id: 'empty',        label: 'Empty',        x: -0.50, y: -0.65, depth: 'surface', cluster: 'numb' },
  { id: 'withdrawn',    label: 'Withdrawn',    x: -0.60, y: -0.65, depth: 'surface', cluster: 'numb' },
  { id: 'disconnected', label: 'Disconnected', x: -0.65, y: -0.70, depth: 'deep',    cluster: 'numb' },
  { id: 'isolated',     label: 'Isolated',     x: -0.70, y: -0.65, depth: 'deep',    cluster: 'numb' },
  { id: 'aloof',        label: 'Aloof',        x: -0.55, y: -0.60, depth: 'deep',    cluster: 'numb' },
  { id: 'bored',        label: 'Bored',        x: -0.40, y: -0.55, depth: 'deep',    cluster: 'numb' },
  { id: 'distant',      label: 'Distant',      x: -0.60, y: -0.60, depth: 'deep',    cluster: 'numb' },
  { id: 'indifferent',  label: 'Indifferent',  x: -0.50, y: -0.60, depth: 'deep',    cluster: 'numb' },
  { id: 'lethargic',    label: 'Lethargic',    x: -0.50, y: -0.75, depth: 'deep',    cluster: 'numb' },
  { id: 'listless',     label: 'Listless',     x: -0.50, y: -0.70, depth: 'deep',    cluster: 'numb' },
  { id: 'removed',      label: 'Removed',      x: -0.60, y: -0.65, depth: 'deep',    cluster: 'numb' },
  { id: 'resistant',    label: 'Resistant',    x: -0.50, y: -0.55, depth: 'deep',    cluster: 'numb' },
  { id: 'shut-down',    label: 'Shut down',    x: -0.65, y: -0.75, depth: 'deep',    cluster: 'numb' },
  { id: 'uneasy',       label: 'Uneasy',       x: -0.45, y: -0.50, depth: 'deep',    cluster: 'numb' },

  // Shame / Embarrassed
  { id: 'ashamed',      label: 'Ashamed',      x: -0.65, y: -0.45, depth: 'surface', cluster: 'shame' },
  { id: 'embarrassed',  label: 'Embarrassed',  x: -0.55, y: -0.40, depth: 'surface', cluster: 'shame' },
  { id: 'worthless',    label: 'Worthless',    x: -0.75, y: -0.50, depth: 'deep',    cluster: 'shame' },
  { id: 'humiliated',   label: 'Humiliated',   x: -0.75, y: -0.45, depth: 'deep',    cluster: 'shame' },
  { id: 'mortified',    label: 'Mortified',    x: -0.70, y: -0.45, depth: 'deep',    cluster: 'shame' },
  { id: 'self-conscious', label: 'Self-conscious', x: -0.55, y: -0.35, depth: 'deep', cluster: 'shame' },
  { id: 'useless',      label: 'Useless',      x: -0.65, y: -0.50, depth: 'deep',    cluster: 'shame' },
  { id: 'weak',         label: 'Weak',         x: -0.60, y: -0.45, depth: 'deep',    cluster: 'shame' },
  { id: 'inhibited',    label: 'Inhibited',    x: -0.45, y: -0.35, depth: 'deep',    cluster: 'shame' },

  // Guilt
  { id: 'regret',       label: 'Regret',       x: -0.55, y: -0.35, depth: 'deep',    cluster: 'guilt' },
  { id: 'remorseful',   label: 'Remorseful',   x: -0.60, y: -0.40, depth: 'deep',    cluster: 'guilt' },
  { id: 'sorry',        label: 'Sorry',        x: -0.50, y: -0.30, depth: 'deep',    cluster: 'guilt' },

  // Powerless / Fragile
  { id: 'helpless',     label: 'Helpless',     x: -0.65, y: -0.60, depth: 'deep',    cluster: 'powerless' },
  { id: 'resigned',     label: 'Resigned',     x: -0.65, y: -0.70, depth: 'deep',    cluster: 'powerless' },
  { id: 'trapped',      label: 'Trapped',      x: -0.70, y: -0.55, depth: 'deep',    cluster: 'powerless' },
  { id: 'incapable',    label: 'Incapable',    x: -0.60, y: -0.55, depth: 'deep',    cluster: 'powerless' },
  { id: 'impotent',     label: 'Impotent',     x: -0.65, y: -0.50, depth: 'deep',    cluster: 'powerless' },
  { id: 'victim',       label: 'Victim',       x: -0.60, y: -0.50, depth: 'deep',    cluster: 'powerless' },
  { id: 'sensitive',    label: 'Sensitive',    x: -0.35, y: -0.30, depth: 'deep',    cluster: 'powerless' },
];
