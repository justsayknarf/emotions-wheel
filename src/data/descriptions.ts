export interface EmotionDescription {
  description: string;
  relatedIds: string[];
}

export const descriptions: Record<string, EmotionDescription> = {
  happy: {
    description: "A warm, open sense that things are good right now. Not euphoria — just the quiet satisfaction of being okay, or more than okay.",
    relatedIds: ['joyful', 'content', 'cheerful', 'pleased', 'grateful'],
  },
  excited: {
    description: "Energy moving forward into something that matters to you. The body leans in; there's a pull toward what's coming.",
    relatedIds: ['enthusiastic', 'eager', 'energized', 'thrilled', 'inspired'],
  },
  enthusiastic: {
    description: "Sustained forward energy with genuine investment — you care about this and it shows.",
    relatedIds: ['excited', 'inspired', 'eager', 'passionate', 'engaged'],
  },
  inspired: {
    description: "A quiet brightness that arrives when something opens up new possibility — an idea, a person, a moment that makes you want to create.",
    relatedIds: ['awe', 'excited', 'hopeful', 'creative', 'uplifted'],
  },
  playful: {
    description: "Light and free — you're not performing, just enjoying the moment for its own sake.",
    relatedIds: ['happy', 'silly', 'free', 'cheerful', 'lively'],
  },
  eager: {
    description: "Ready to move. The gap between now and what comes next feels small and inviting.",
    relatedIds: ['excited', 'enthusiastic', 'hopeful', 'determined', 'anticipating'],
  },
  amazed: {
    description: "Something exceeded what you thought was possible. The world just got a little bigger.",
    relatedIds: ['awe', 'surprised', 'delighted', 'enchanted', 'inspired'],
  },
  delighted: {
    description: "Pleasantly caught off guard by something good. A small joy that lands with more weight than expected.",
    relatedIds: ['happy', 'amazed', 'pleased', 'charmed', 'cheerful'],
  },
  ecstatic: {
    description: "Joy at maximum volume — the kind that's hard to contain and doesn't need to be.",
    relatedIds: ['thrilled', 'bliss', 'radiant', 'elated', 'overjoyed'],
  },
  thrilled: {
    description: "Excited with a spike of electricity — the body notices this one.",
    relatedIds: ['ecstatic', 'excited', 'energized', 'elated', 'bliss'],
  },
  bliss: {
    description: "Complete and quiet. No wanting, no reaching — just being fully here.",
    relatedIds: ['serene', 'content', 'peaceful', 'ecstatic', 'radiant'],
  },
  radiant: {
    description: "Lit from within, and it shows outward without effort.",
    relatedIds: ['vibrant', 'ecstatic', 'bliss', 'joyful', 'uplifted'],
  },
  enchanted: {
    description: "Held in a spell of something beautiful or surprising. Reality softened a little.",
    relatedIds: ['awe', 'amazed', 'charmed', 'mesmerized', 'delighted'],
  },
  awe: {
    description: "Standing before something vastly larger than yourself — the feeling of scale, of smallness that isn't diminishing.",
    relatedIds: ['amazed', 'enchanted', 'inspired', 'humbled', 'reverence'],
  },
  lively: {
    description: "Animated and present — there's spark in you right now.",
    relatedIds: ['energized', 'playful', 'vibrant', 'cheerful', 'radiant'],
  },
  passionate: {
    description: "Caring deeply enough to pour yourself into something. The opposite of going through the motions.",
    relatedIds: ['inspired', 'determined', 'enthusiastic', 'intense', 'devoted'],
  },
  vibrant: {
    description: "Fully alive in the body and mind. Colors feel more saturated; you're switched on.",
    relatedIds: ['energized', 'lively', 'radiant', 'invigorated', 'alive'],
  },
  free: {
    description: "No obligations pressing in, no performance required. Room to just be.",
    relatedIds: ['playful', 'peaceful', 'content', 'open', 'unburdened'],
  },
  energized: {
    description: "The tank feels full. There's fuel here for whatever comes next.",
    relatedIds: ['excited', 'invigorated', 'refreshed', 'vibrant', 'ready'],
  },
  invigorated: {
    description: "Refreshed with edge — like cold air after you've been inside too long.",
    relatedIds: ['energized', 'refreshed', 'renewed', 'alive', 'vibrant'],
  },
  refreshed: {
    description: "Reset. Whatever was weighing you down lifted, at least for now.",
    relatedIds: ['renewed', 'invigorated', 'relieved', 'peaceful', 'clear'],
  },
  rejuvenated: {
    description: "Restored after depletion — a second wind that arrived just in time.",
    relatedIds: ['refreshed', 'renewed', 'restored', 'energized', 'revived'],
  },
  renewed: {
    description: "Something old shed; something forward-facing arrived. Not the same as before.",
    relatedIds: ['rejuvenated', 'refreshed', 'hopeful', 'restored', 'transformed'],
  },
  confident: {
    description: "Trust in your own capacity — not certainty, but enough grounding to move forward.",
    relatedIds: ['capable', 'strong', 'assured', 'determined', 'proud'],
  },
  proud: {
    description: "Recognition that something you did or are matters. You let yourself feel it.",
    relatedIds: ['confident', 'accomplished', 'satisfied', 'worthy', 'strong'],
  },
  strong: {
    description: "Solid in yourself. External pressure isn't moving you right now.",
    relatedIds: ['confident', 'determined', 'capable', 'brave', 'resilient'],
  },
  brave: {
    description: "Moving toward something despite the fear being real. Courage doesn't mean it's easy.",
    relatedIds: ['determined', 'strong', 'daring', 'capable', 'resilient'],
  },
  determined: {
    description: "Locked in. Obstacles register but don't stop the forward motion.",
    relatedIds: ['focused', 'committed', 'strong', 'persistent', 'driven'],
  },
  adventurous: {
    description: "Open to what's unknown rather than threatened by it. The unfamiliar feels like invitation.",
    relatedIds: ['curious', 'daring', 'free', 'excited', 'brave'],
  },
  daring: {
    description: "Willing to risk something — comfort, certainty, opinion — because what you want is worth it.",
    relatedIds: ['brave', 'adventurous', 'bold', 'confident', 'reckless'],
  },
  capable: {
    description: "You have what this takes. The tools, the experience, the steadiness.",
    relatedIds: ['confident', 'competent', 'strong', 'prepared', 'resourceful'],
  },
  grateful: {
    description: "Noticing the good and feeling moved by it rather than taking it for granted.",
    relatedIds: ['content', 'appreciative', 'humbled', 'touched', 'blessed'],
  },
  appreciative: {
    description: "Actively registering value — in a person, a moment, a small thing that could have gone unnoticed.",
    relatedIds: ['grateful', 'touched', 'warm', 'present', 'thankful'],
  },
  touched: {
    description: "Something moved you without overwhelming you. A gentle opening.",
    relatedIds: ['moved', 'grateful', 'appreciative', 'tender', 'warm'],
  },
  moved: {
    description: "Something reached past your defenses and landed. You felt it fully.",
    relatedIds: ['touched', 'tender', 'overwhelmed', 'connected', 'affected'],
  },
  joyful: {
    description: "An overflowing of the good — more than happy, less contained.",
    relatedIds: ['happy', 'delighted', 'elated', 'radiant', 'bliss'],
  },
  loving: {
    description: "The presence of deep care — for someone, something, or the world.",
    relatedIds: ['tender', 'connected', 'devoted', 'warm', 'affectionate'],
  },
  tender: {
    description: "Soft in a way you don't usually let yourself be. Protective of something fragile.",
    relatedIds: ['loving', 'moved', 'gentle', 'vulnerable', 'touched'],
  },
  connected: {
    description: "Not alone in this. The membrane between you and the world thinned a little.",
    relatedIds: ['belonging', 'loved', 'understood', 'seen', 'warm'],
  },
  warm: {
    description: "A gentle positive glow that doesn't need a reason.",
    relatedIds: ['content', 'comfortable', 'connected', 'safe', 'cozy'],
  },
  content: {
    description: "Nothing missing right now. Not euphoria — just quiet completion.",
    relatedIds: ['peaceful', 'satisfied', 'serene', 'comfortable', 'bliss'],
  },
  satisfied: {
    description: "The loop closed. Something was needed, and it was met.",
    relatedIds: ['content', 'accomplished', 'fulfilled', 'proud', 'complete'],
  },
  peaceful: {
    description: "Conflict — internal or external — has quieted. There's space here.",
    relatedIds: ['calm', 'serene', 'still', 'content', 'relaxed'],
  },
  serene: {
    description: "Undisturbed. A stillness that isn't emptiness — more like water without wind.",
    relatedIds: ['peaceful', 'calm', 'tranquil', 'content', 'bliss'],
  },
  calm: {
    description: "Steadied. The nervous system found its footing.",
    relatedIds: ['peaceful', 'serene', 'grounded', 'relaxed', 'still'],
  },
  relaxed: {
    description: "Tension released. The body stopped bracing.",
    relatedIds: ['calm', 'comfortable', 'at_ease', 'peaceful', 'relieved'],
  },
  comfortable: {
    description: "No friction between you and where you are right now.",
    relatedIds: ['relaxed', 'safe', 'warm', 'content', 'at_ease'],
  },
  safe: {
    description: "The threat is off. Whatever was watching for danger can rest.",
    relatedIds: ['secure', 'comfortable', 'calm', 'protected', 'grounded'],
  },
  secure: {
    description: "Anchored. The foundation is solid and you're not falling.",
    relatedIds: ['safe', 'grounded', 'confident', 'stable', 'certain'],
  },
  grounded: {
    description: "Rooted in this moment, this body, this reality. Not spinning out.",
    relatedIds: ['stable', 'calm', 'secure', 'centered', 'present'],
  },
  hopeful: {
    description: "Something good might happen. Not certainty — a leaning toward possibility.",
    relatedIds: ['optimistic', 'anticipating', 'encouraged', 'inspired', 'eager'],
  },
  optimistic: {
    description: "Things will work out. Maybe not perfectly, but enough.",
    relatedIds: ['hopeful', 'encouraged', 'confident', 'positive', 'expecting'],
  },
  curious: {
    description: "Pulled toward the unknown. You want to understand this.",
    relatedIds: ['interested', 'fascinated', 'open', 'adventurous', 'engaged'],
  },
  interested: {
    description: "Something has your attention. Not distracted — actually here.",
    relatedIds: ['curious', 'engaged', 'fascinated', 'present', 'attentive'],
  },
  engaged: {
    description: "Fully in it. The work or the conversation or the moment has you.",
    relatedIds: ['interested', 'focused', 'present', 'absorbed', 'committed'],
  },
  focused: {
    description: "One thing. The noise moved aside and this is what remains.",
    relatedIds: ['engaged', 'determined', 'clear', 'present', 'sharp'],
  },
  clear: {
    description: "Things make sense right now. The fog lifted.",
    relatedIds: ['focused', 'grounded', 'certain', 'refreshed', 'decisive'],
  },
  open: {
    description: "Receptive. Not braced for impact, not already decided.",
    relatedIds: ['curious', 'accepting', 'receptive', 'flexible', 'present'],
  },
  present: {
    description: "Here. Not in the past or future — this moment has you fully.",
    relatedIds: ['grounded', 'calm', 'aware', 'engaged', 'centered'],
  },
  alive: {
    description: "The fact of existing hits you as something remarkable rather than given.",
    relatedIds: ['vibrant', 'energized', 'present', 'invigorated', 'awakened'],
  },
  uplifted: {
    description: "Something raised you — a word, a song, a sky, a person.",
    relatedIds: ['inspired', 'hopeful', 'moved', 'grateful', 'radiant'],
  },
  cheerful: {
    description: "A light brightness that spreads easily — the mood that makes rooms easier.",
    relatedIds: ['happy', 'playful', 'lively', 'warm', 'pleasant'],
  },
  amused: {
    description: "Something struck you as funny. A small brightening.",
    relatedIds: ['playful', 'cheerful', 'entertained', 'delighted', 'silly'],
  },
  silly: {
    description: "Not taking yourself seriously. The rules are off for a moment.",
    relatedIds: ['playful', 'amused', 'free', 'lighthearted', 'goofy'],
  },
  // --- Q2: Low arousal, Positive valence (Calm-Positive) ---
  fulfilled: {
    description: "Life is doing what it's supposed to do. The deeper goals are being met.",
    relatedIds: ['satisfied', 'content', 'complete', 'purposeful', 'whole'],
  },
  accomplished: {
    description: "Something that required effort is done, and it was real effort.",
    relatedIds: ['proud', 'satisfied', 'successful', 'capable', 'fulfilled'],
  },
  at_ease: {
    description: "The effort to hold yourself together isn't needed right now.",
    relatedIds: ['relaxed', 'comfortable', 'peaceful', 'calm', 'relieved'],
  },
  comfortable_adj: {
    description: "No friction between you and where you are right now.",
    relatedIds: ['safe', 'warm', 'relaxed', 'content', 'at_ease'],
  },
  tranquil: {
    description: "Even deeper than calm — undisturbed at the root.",
    relatedIds: ['serene', 'peaceful', 'still', 'quiet', 'undisturbed'],
  },
  still: {
    description: "Motion stopped, and that's okay. The quiet is welcome.",
    relatedIds: ['peaceful', 'calm', 'serene', 'present', 'tranquil'],
  },
  // --- Q3/Q4: Negative valence ---
  anxious: {
    description: "Bracing for something uncertain. The mind runs the contingencies before the event arrives.",
    relatedIds: ['worried', 'nervous', 'fearful', 'tense', 'unsettled'],
  },
  worried: {
    description: "Concerned about something specific. The loop keeps returning to it.",
    relatedIds: ['anxious', 'troubled', 'uneasy', 'fearful', 'apprehensive'],
  },
  fearful: {
    description: "Something feels genuinely threatening — body, status, future, relationship.",
    relatedIds: ['scared', 'anxious', 'panicked', 'threatened', 'vulnerable'],
  },
  scared: {
    description: "The threat feels immediate and real. The system fired.",
    relatedIds: ['fearful', 'panicked', 'startled', 'terrified', 'anxious'],
  },
  stressed: {
    description: "Too much is pressing in at once. The bandwidth is full or beyond.",
    relatedIds: ['overwhelmed', 'anxious', 'tense', 'depleted', 'pressured'],
  },
  overwhelmed: {
    description: "More than can be held right now. The system is at capacity and then some.",
    relatedIds: ['stressed', 'flooded', 'depleted', 'lost', 'exhausted'],
  },
  angry: {
    description: "A boundary was crossed — your own or someone else's. Something is not right and you know it.",
    relatedIds: ['frustrated', 'furious', 'irritated', 'resentful', 'indignant'],
  },
  frustrated: {
    description: "Something is in the way and the way forward isn't clear. The stuck feeling.",
    relatedIds: ['angry', 'irritated', 'impatient', 'blocked', 'agitated'],
  },
  irritated: {
    description: "Low-grade friction. Something is bothering you and you'd like it to stop.",
    relatedIds: ['annoyed', 'frustrated', 'agitated', 'bothered', 'impatient'],
  },
  annoyed: {
    description: "A small, specific thing is getting to you.",
    relatedIds: ['irritated', 'bothered', 'impatient', 'frustrated', 'exasperated'],
  },
  furious: {
    description: "Anger at full volume. The boundary crossed was significant.",
    relatedIds: ['angry', 'enraged', 'outraged', 'incensed', 'livid'],
  },
  sad: {
    description: "Something is lost or missing, and the absence is felt. Not broken — just sad.",
    relatedIds: ['grieving', 'lonely', 'disappointed', 'melancholy', 'sorrowful'],
  },
  lonely: {
    description: "Present but not seen. Or absent from those who would see you.",
    relatedIds: ['isolated', 'disconnected', 'longing', 'sad', 'empty'],
  },
  disappointed: {
    description: "Expectation met reality, and they didn't match. The gap between hoped-for and actual.",
    relatedIds: ['sad', 'let_down', 'deflated', 'discouraged', 'frustrated'],
  },
  grieving: {
    description: "Mourning a real loss — of a person, a future, a version of yourself or your life.",
    relatedIds: ['sad', 'heartbroken', 'bereft', 'sorrowful', 'aching'],
  },
  heartbroken: {
    description: "Something that held you together broke, and the breaking is its own kind of event.",
    relatedIds: ['grieving', 'devastated', 'sad', 'shattered', 'bereft'],
  },
  guilty: {
    description: "You did something that crossed your own values, and you know it.",
    relatedIds: ['ashamed', 'regretful', 'remorseful', 'self_blame', 'troubled'],
  },
  ashamed: {
    description: "Not just what you did, but who you are feels implicated. The exposure feels unbearable.",
    relatedIds: ['guilty', 'humiliated', 'embarrassed', 'self_blame', 'worthless'],
  },
  embarrassed: {
    description: "Seen in a way you didn't want to be seen. The exposure is uncomfortable.",
    relatedIds: ['ashamed', 'self_conscious', 'flustered', 'awkward', 'vulnerable'],
  },
  vulnerable: {
    description: "Unguarded in a way that feels risky. The armor is off.",
    relatedIds: ['exposed', 'tender', 'open', 'scared', 'uncertain'],
  },
  uncertain: {
    description: "No solid footing in what comes next or who you are in this.",
    relatedIds: ['confused', 'lost', 'unsure', 'anxious', 'doubtful'],
  },
  confused: {
    description: "The map doesn't match the territory. Something isn't making sense.",
    relatedIds: ['uncertain', 'lost', 'disoriented', 'overwhelmed', 'puzzled'],
  },
  lost: {
    description: "Not knowing where you are or where you're going. The familiar markers are gone.",
    relatedIds: ['confused', 'uncertain', 'adrift', 'disoriented', 'disconnected'],
  },
  depleted: {
    description: "There's nothing left in the tank. Not tired — empty.",
    relatedIds: ['exhausted', 'burned_out', 'drained', 'spent', 'overwhelmed'],
  },
  exhausted: {
    description: "Beyond tired. The body and mind have been running too long on too little.",
    relatedIds: ['depleted', 'drained', 'burned_out', 'weary', 'spent'],
  },
  numb: {
    description: "The feelings stopped. Not calm — disconnected from the range of it.",
    relatedIds: ['disconnected', 'empty', 'detached', 'flat', 'dissociated'],
  },
  empty: {
    description: "Nothing where something should be. A hollow where feeling used to live.",
    relatedIds: ['numb', 'hollow', 'disconnected', 'lonely', 'flat'],
  },
  hopeless: {
    description: "The belief that things can change has dimmed. Nothing feels reachable.",
    relatedIds: ['despair', 'empty', 'defeated', 'resigned', 'lost'],
  },
  despair: {
    description: "Hope has fully gone. The darkness has settled in and isn't responding to effort.",
    relatedIds: ['hopeless', 'devastated', 'shattered', 'bereft', 'anguish'],
  },
  resentful: {
    description: "Old anger that didn't get to go anywhere. It settled in and stayed.",
    relatedIds: ['bitter', 'angry', 'hurt', 'betrayed', 'grudging'],
  },
  jealous: {
    description: "Someone has something you want, and the gap stings.",
    relatedIds: ['envious', 'insecure', 'resentful', 'wanting', 'comparison'],
  },
  envious: {
    description: "They have what you want, and part of you wishes they didn't.",
    relatedIds: ['jealous', 'wanting', 'bitter', 'inferior', 'resentful'],
  },
  bored: {
    description: "Nothing here is engaging what you actually have. Understimulated.",
    relatedIds: ['restless', 'disengaged', 'flat', 'unsatisfied', 'idle'],
  },
  restless: {
    description: "Too much energy without somewhere to go. The body wants to move; the mind can't land.",
    relatedIds: ['bored', 'agitated', 'unsettled', 'tense', 'impatient'],
  },
  tense: {
    description: "Braced. The muscles and the mind are waiting for something.",
    relatedIds: ['anxious', 'stressed', 'restless', 'wound_up', 'on_edge'],
  },
  unsettled: {
    description: "Something is off but you can't quite name it. The discomfort of vague wrongness.",
    relatedIds: ['uneasy', 'anxious', 'troubled', 'tense', 'uncertain'],
  },
  uneasy: {
    description: "The feeling before you know what's wrong. A subtle, persistent discomfort.",
    relatedIds: ['unsettled', 'anxious', 'troubled', 'uncertain', 'worried'],
  },
  reluctant: {
    description: "You'll do it, but not happily. Something is pulling against the forward motion.",
    relatedIds: ['resistant', 'hesitant', 'uncertain', 'conflicted', 'ambivalent'],
  },
  conflicted: {
    description: "Two real things pulling in opposite directions. Both are true; they can't both win.",
    relatedIds: ['ambivalent', 'torn', 'uncertain', 'stuck', 'hesitant'],
  },
  ambivalent: {
    description: "You want this and you don't want this at the same time. Both are genuine.",
    relatedIds: ['conflicted', 'torn', 'uncertain', 'mixed', 'hesitant'],
  },
  disconnected: {
    description: "The link to yourself or others has gone offline. You're present but not here.",
    relatedIds: ['numb', 'detached', 'isolated', 'empty', 'disengaged'],
  },
  detached: {
    description: "Watching from behind glass. Things are registering but not landing.",
    relatedIds: ['disconnected', 'numb', 'dissociated', 'distant', 'disengaged'],
  },
  regretful: {
    description: "Something you did or didn't do followed you here. You wish it had gone differently.",
    relatedIds: ['guilty', 'remorseful', 'sad', 'wishing', 'self_blame'],
  },
  melancholy: {
    description: "A gentle, somewhat beautiful sadness. Not acute pain — a quiet ache.",
    relatedIds: ['sad', 'wistful', 'nostalgic', 'bittersweet', 'longing'],
  },
  nostalgic: {
    description: "Pulled back toward something that no longer exists the way it did.",
    relatedIds: ['melancholy', 'wistful', 'longing', 'bittersweet', 'remembering'],
  },
  wistful: {
    description: "Tenderly wanting something that's just out of reach — past or future.",
    relatedIds: ['nostalgic', 'melancholy', 'longing', 'bittersweet', 'yearning'],
  },
  longing: {
    description: "A deep ache toward something absent — a person, a time, a version of your life.",
    relatedIds: ['wistful', 'nostalgic', 'missing', 'yearning', 'aching'],
  },
  hurt: {
    description: "Someone crossed something that matters. The sting of it is real.",
    relatedIds: ['wounded', 'betrayed', 'sad', 'disappointed', 'resentful'],
  },
  betrayed: {
    description: "Trust was placed and then used against you. The particular sting of this specific kind of hurt.",
    relatedIds: ['hurt', 'resentful', 'angry', 'heartbroken', 'disillusioned'],
  },
  humiliated: {
    description: "Dignity stripped away in a witnessed moment. The exposure is total.",
    relatedIds: ['ashamed', 'embarrassed', 'degraded', 'small', 'wounded'],
  },
  outraged: {
    description: "Something happened that violated what should be true about the world.",
    relatedIds: ['indignant', 'furious', 'angry', 'appalled', 'incensed'],
  },
  indignant: {
    description: "Righteous displeasure — something unfair happened and it shouldn't have.",
    relatedIds: ['outraged', 'angry', 'insulted', 'wronged', 'resentful'],
  },
  appalled: {
    description: "Struck by something so wrong you can barely take it in.",
    relatedIds: ['outraged', 'horrified', 'shocked', 'disturbed', 'disgusted'],
  },
  disgusted: {
    description: "Something crossed a threshold of what you can accept — viscerally wrong.",
    relatedIds: ['appalled', 'revolted', 'offended', 'disturbed', 'repulsed'],
  },
  shocked: {
    description: "Reality just departed from what you expected. The system hasn't caught up yet.",
    relatedIds: ['surprised', 'stunned', 'disbelief', 'startled', 'appalled'],
  },
  surprised: {
    description: "Something arrived that wasn't in the model. Neutral until the next feeling tells you what to do with it.",
    relatedIds: ['shocked', 'startled', 'amazed', 'caught_off_guard', 'disbelief'],
  },
  panicked: {
    description: "Overwhelm plus urgency. The system is flooded and demanding action now.",
    relatedIds: ['terrified', 'scared', 'overwhelmed', 'frantic', 'desperate'],
  },
  helpless: {
    description: "No available moves. The agency that usually shows up isn't here.",
    relatedIds: ['powerless', 'trapped', 'hopeless', 'stuck', 'desperate'],
  },
  powerless: {
    description: "The situation is happening to you and you can't change it.",
    relatedIds: ['helpless', 'trapped', 'frustrated', 'victimized', 'voiceless'],
  },
  burned_out: {
    description: "Depleted past the point where rest alone fixes it. The fire that fueled the effort went out.",
    relatedIds: ['depleted', 'exhausted', 'disengaged', 'empty', 'numb'],
  },
  defeated: {
    description: "The fight left. It's not that you quit — it's that the opposition won.",
    relatedIds: ['hopeless', 'resigned', 'deflated', 'broken', 'depleted'],
  },
  resigned: {
    description: "Stopped fighting what you can't change. May be peace or may be giving up — sometimes hard to tell.",
    relatedIds: ['defeated', 'acceptance', 'hopeless', 'tired', 'let_go'],
  },
  // Additional misc emotions
  grateful_adj: {
    description: "Noticing the good and feeling moved by it rather than taking it for granted.",
    relatedIds: ['appreciative', 'humbled', 'touched', 'blessed', 'content'],
  },
  accepted: {
    description: "You belong here. No performance required to earn your place.",
    relatedIds: ['loved', 'seen', 'belonging', 'connected', 'safe'],
  },
  proud_adj: {
    description: "Recognition that something you did or are matters. You let yourself feel it.",
    relatedIds: ['accomplished', 'confident', 'satisfied', 'worthy', 'strong'],
  },

  // radial-intensity: courageous cluster
  worthy: {
    description: "Deserving of care and good things without having to earn them first. You can let that be true today.",
    relatedIds: ['grounded', 'capable', 'proud', 'valiant'],
  },
  valiant: {
    description: "Standing up for something or someone even though it costs you. Brave, with a cause behind it.",
    relatedIds: ['proud', 'capable', 'strong', 'confident'],
  },
  // radial-intensity: curious cluster
  intrigued: {
    description: "Something snagged your attention and you want to know more. A small hook, gently pulling.",
    relatedIds: ['involved', 'interested', 'fascinated', 'curious'],
  },
  involved: {
    description: "Part of what's happening rather than watching it. You've got a hand in it and a stake in how it goes.",
    relatedIds: ['intrigued', 'fascinated', 'curious', 'interested'],
  },
  fascinated: {
    description: "So absorbed that time slips. You keep looking because there's always more to see.",
    relatedIds: ['curious', 'involved', 'engaged', 'intrigued'],
  },
  exploring: {
    description: "Out in the open, following whatever turns up next. Heading into the unknown on purpose.",
    relatedIds: ['stimulated', 'engaged', 'curious', 'fascinated'],
  },
  stimulated: {
    description: "Your mind is buzzing. Ideas and input are firing faster than you can catch them.",
    relatedIds: ['exploring', 'engaged', 'curious', 'fascinated'],
  },
  // radial-intensity: peaceful cluster
  centered: {
    description: "Balanced around your own middle. Things can tilt around you without tipping you over.",
    relatedIds: ['present', 'trusting', 'relaxed', 'patient'],
  },
  trusting: {
    description: "Willing to lean on someone or something without checking twice. Your guard can stay down.",
    relatedIds: ['centered', 'relaxed', 'present', 'patient'],
  },
  patient: {
    description: "Able to wait without strain. What's slow can be slow; you don't need to push it along.",
    relatedIds: ['relaxed', 'calm', 'trusting', 'centered'],
  },
  // radial-intensity: loving cluster
  reflective: {
    description: "Turned gently inward, looking back over something. Unhurried, letting it settle and show you what it means.",
    relatedIds: ['vulnerable', 'accepting', 'caring', 'empathetic'],
  },
  accepting: {
    description: "Letting something be as it is, without needing it to change first. Sometimes that something is you.",
    relatedIds: ['vulnerable', 'caring', 'empathetic', 'reflective'],
  },
  caring: {
    description: "Wanting good things for someone and keeping an eye on how they're doing.",
    relatedIds: ['accepting', 'empathetic', 'self-loving', 'vulnerable'],
  },
  empathetic: {
    description: "Feeling a little of what someone else feels, from the inside. Their weather reaches you too.",
    relatedIds: ['caring', 'self-loving', 'compassionate', 'accepting'],
  },
  'self-loving': {
    description: "Treating yourself with the kindness you'd give a good friend. On your own side, gently and on purpose.",
    relatedIds: ['compassionate', 'empathetic', 'caring', 'affectionate'],
  },
  compassionate: {
    description: "Seeing someone's pain and wanting to ease it. Your heart moves toward them instead of away.",
    relatedIds: ['self-loving', 'affectionate', 'empathetic', 'warm'],
  },
  affectionate: {
    description: "Fondness that wants to show itself: a hug, a nickname, a hand on the shoulder.",
    relatedIds: ['warm', 'compassionate', 'self-loving', 'loving'],
  },
  // radial-intensity: grateful cluster
  humbled: {
    description: "Made smaller in a good way, by kindness you didn't expect or by something far bigger than you.",
    relatedIds: ['moved', 'touched', 'grateful', 'appreciative'],
  },
  grace: {
    description: "What it's like to be given more than you earned. Goodness arrives freely, and something in you softens.",
    relatedIds: ['fortunate', 'appreciative', 'grateful', 'thankful'],
  },
  fortunate: {
    description: "Things broke your way, and you know they might not have. Luck you can actually feel.",
    relatedIds: ['thankful', 'grace', 'blessed', 'appreciative'],
  },
  thankful: {
    description: "Gratitude with somewhere to go. You want to say thank you, out loud, to someone in particular.",
    relatedIds: ['fortunate', 'blessed', 'grace', 'appreciative'],
  },
  blessed: {
    description: "So much good around you that it feels like a gift you could never have arranged yourself. Full to the brim.",
    relatedIds: ['thankful', 'fortunate', 'grace', 'appreciative'],
  },
  // radial-intensity: hopeful cluster
  expectant: {
    description: "Waiting for something you believe is on its way. Quiet, watchful, a little lit up.",
    relatedIds: ['hopeful', 'encouraged', 'optimistic'],
  },
  encouraged: {
    description: "Something gave you heart — a kind word, a sign, a small win — and now you want to keep going.",
    relatedIds: ['hopeful', 'optimistic', 'expectant'],
  },
  // radial-intensity: angry cluster
  moody: {
    description: "Your mood keeps shifting under you, tipping dark without much warning. Hard to predict, even from inside.",
    relatedIds: ['grouchy', 'cynical', 'irritated', 'disgruntled'],
  },
  grouchy: {
    description: "Short-tempered in a low, grumbling way. You'd rather be left alone until it passes.",
    relatedIds: ['moody', 'cynical', 'irritated', 'disgruntled'],
  },
  cynical: {
    description: "Expecting the worst of people's motives. Hard to be let down when you never bought in.",
    relatedIds: ['irritated', 'grouchy', 'moody', 'disdain'],
  },
  disdain: {
    description: "Looking down on something as not worth your time. Cool and dismissive, keeping it at a distance.",
    relatedIds: ['cynical', 'irritated', 'grouchy', 'disgruntled'],
  },
  disgruntled: {
    description: "Quietly unhappy with how things are being handled. A complaint you keep muttering, mostly to yourself.",
    relatedIds: ['impatient', 'irritated', 'bitter', 'cynical'],
  },
  impatient: {
    description: "Everything's moving slower than you can stand. You want to skip ahead to the part where it's done.",
    relatedIds: ['disgruntled', 'edgy', 'bitter', 'irritated'],
  },
  bitter: {
    description: "A hurt that soured over time. Now it flavors everything near it, like an aftertaste that won't wash out.",
    relatedIds: ['contempt', 'disgruntled', 'impatient', 'upset'],
  },
  edgy: {
    description: "Prickly and easily set off. One more small thing and you might snap.",
    relatedIds: ['impatient', 'upset', 'disgruntled', 'bitter'],
  },
  contempt: {
    description: "Seeing someone as beneath you. Anger gone cold and personal, with a curl of the lip.",
    relatedIds: ['bitter', 'resentful', 'upset', 'frustrated'],
  },
  upset: {
    description: "Knocked off balance by something that hurt or wronged you. Stirred up and not settled yet.",
    relatedIds: ['resentful', 'contempt', 'edgy', 'disturbed'],
  },
  disturbed: {
    description: "Something you saw or heard sits deeply wrong with you. It keeps bothering you and won't let go.",
    relatedIds: ['exasperated', 'aggravated', 'upset', 'agitated'],
  },
  exasperated: {
    description: "Your patience is used up. You've explained, waited and tried again, and now you're throwing up your hands.",
    relatedIds: ['aggravated', 'frustrated', 'disturbed', 'agitated'],
  },
  aggravated: {
    description: "Something kept pressing on the same sore spot until a small annoyance became a real grievance.",
    relatedIds: ['agitated', 'exasperated', 'angry', 'disturbed'],
  },
  agitated: {
    description: "Anger stirring in the body: pacing, fidgeting, unable to settle. It wants somewhere to go.",
    relatedIds: ['aggravated', 'angry', 'exasperated', 'hostile'],
  },
  vindictive: {
    description: "Wanting them to hurt the way you hurt. The pull to even the score.",
    relatedIds: ['exasperated', 'hostile', 'pissed', 'frustrated'],
  },
  hostile: {
    description: "Braced against someone and ready for a fight. Your guard is up and pointed outward.",
    relatedIds: ['pissed', 'angry', 'irate', 'outraged'],
  },
  pissed: {
    description: "Plain, blunt anger. Someone messed up and you're done being polite about it.",
    relatedIds: ['hostile', 'irate', 'outraged', 'angry'],
  },
  irate: {
    description: "Loud, open anger that raises your voice and heats your face. Close to boiling over.",
    relatedIds: ['outraged', 'pissed', 'hostile', 'furious'],
  },
  // radial-intensity: stressed cluster
  cranky: {
    description: "Tired and touchy. Little things grate because there's nothing left to cushion them.",
    relatedIds: ['worn-out', 'restless', 'weary', 'depleted'],
  },
  'worn-out': {
    description: "Used hard and running thin. You need rest, and your body is making sure you know it.",
    relatedIds: ['cranky', 'weary', 'depleted', 'restless'],
  },
  weary: {
    description: "Tiredness that has settled into your bones from carrying something for a long while.",
    relatedIds: ['depleted', 'worn-out', 'tight', 'cranky'],
  },
  tight: {
    description: "Held tense somewhere — jaw, shoulders, chest. Your body is gripping before your mind has noticed why.",
    relatedIds: ['depleted', 'on-edge', 'weary', 'shaken'],
  },
  'on-edge': {
    description: "Alert for the next thing to go wrong. Every ping or footstep makes you flinch a little.",
    relatedIds: ['tight', 'shaken', 'depleted', 'burned-out'],
  },
  shaken: {
    description: "Something rocked you and you haven't steadied yet. The tremor is still running through you.",
    relatedIds: ['burned-out', 'on-edge', 'rattled', 'tight'],
  },
  'burned-out': {
    description: "You've given past the point of refilling. Even things you care about feel like they cost too much.",
    relatedIds: ['shaken', 'rattled', 'on-edge', 'stressed'],
  },
  rattled: {
    description: "Thrown off your stride and scrambling to recover. Your composure slipped and you're grabbing for it.",
    relatedIds: ['stressed', 'burned-out', 'frazzled', 'shaken'],
  },
  frazzled: {
    description: "Pulled in too many directions at once. Frayed at every edge and running on scattered nerves.",
    relatedIds: ['stressed', 'overwhelmed', 'rattled', 'burned-out'],
  },
  // radial-intensity: fear cluster
  hesitant: {
    description: "Pausing at the edge before you step. Part of you wants to go; part of you isn't sure it's safe.",
    relatedIds: ['apprehensive', 'worried', 'nervous', 'afraid'],
  },
  apprehensive: {
    description: "A quiet unease about something that hasn't happened yet. Not fear exactly — more like bracing.",
    relatedIds: ['hesitant', 'worried', 'nervous', 'afraid'],
  },
  nervous: {
    description: "Jittery about what's coming. Butterflies, busy hands, a mind that keeps rehearsing.",
    relatedIds: ['afraid', 'worried', 'apprehensive', 'anxious'],
  },
  afraid: {
    description: "Something feels dangerous, and you want to pull back from it. Plain, honest fear.",
    relatedIds: ['nervous', 'anxious', 'paralyzed', 'worried'],
  },
  paralyzed: {
    description: "Fear strong enough to freeze you. You can't move toward the thing or away from it.",
    relatedIds: ['scared', 'afraid', 'frightened', 'anxious'],
  },
  frightened: {
    description: "A sudden jolt of fear that sets your heart racing. It arrived fast and took hold.",
    relatedIds: ['scared', 'panic', 'terrified', 'paralyzed'],
  },
  panic: {
    description: "Fear taking over the body. Breath short, heart pounding, every thought shouting to get out now.",
    relatedIds: ['terrified', 'frightened', 'scared', 'paralyzed'],
  },
  terrified: {
    description: "Fear at its very peak. Everything in you is braced for the worst.",
    relatedIds: ['panic', 'frightened', 'scared', 'paralyzed'],
  },
  // radial-intensity: unsettled cluster
  questioning: {
    description: "Turning something over before you accept it. A gentle doubt that keeps asking whether this is right.",
    relatedIds: ['unsure', 'reluctant', 'skeptical', 'dissatisfied'],
  },
  unsure: {
    description: "You don't know which way to go, and no option feels clearly right yet.",
    relatedIds: ['reluctant', 'questioning', 'skeptical', 'dissatisfied'],
  },
  skeptical: {
    description: "Holding back your belief until you see more. The claim still has to prove itself.",
    relatedIds: ['reluctant', 'dissatisfied', 'unsure', 'concerned'],
  },
  dissatisfied: {
    description: "Something falls short of what you needed, and you can't settle into it the way it is.",
    relatedIds: ['skeptical', 'concerned', 'reluctant', 'confused'],
  },
  concerned: {
    description: "Something you care about might be at risk, so your attention keeps drifting back to check on it.",
    relatedIds: ['confused', 'dissatisfied', 'skeptical', 'perplexed'],
  },
  perplexed: {
    description: "Thoroughly puzzled. You've looked at it from every side and it still won't add up.",
    relatedIds: ['confused', 'suspicious', 'ungrounded', 'concerned'],
  },
  suspicious: {
    description: "Sensing a hidden motive or a catch. You're watching closely, waiting for the other shoe to drop.",
    relatedIds: ['ungrounded', 'perplexed', 'rejecting', 'confused'],
  },
  ungrounded: {
    description: "Nothing solid underfoot. Your thoughts drift and scatter, and you can't find your center.",
    relatedIds: ['rejecting', 'suspicious', 'perplexed', 'shocked'],
  },
  rejecting: {
    description: "Pushing something away hard — an idea, a person, a situation. Everything in you says no.",
    relatedIds: ['ungrounded', 'suspicious', 'shocked', 'perplexed'],
  },
  // radial-intensity: sad cluster
  yearning: {
    description: "A soft, steady reaching toward something you want but don't have. Your heart leaning out the window.",
    relatedIds: ['teary', 'unhappy', 'lonely', 'disappointed'],
  },
  teary: {
    description: "Close to crying. The feeling is right at the surface, ready to spill over.",
    relatedIds: ['unhappy', 'yearning', 'lonely', 'disappointed'],
  },
  unhappy: {
    description: "Things aren't good right now and you feel it. A general low that doesn't need a single cause.",
    relatedIds: ['lonely', 'teary', 'yearning', 'disappointed'],
  },
  discouraged: {
    description: "You tried and it didn't work, and the will to keep at it has dipped.",
    relatedIds: ['melancholy', 'sad', 'gloomy', 'longing'],
  },
  gloomy: {
    description: "A grey cloud over everything. Hard to see a bright side, or to want to look for one.",
    relatedIds: ['melancholy', 'sorrow', 'grief', 'discouraged'],
  },
  sorrow: {
    description: "Deep sadness with weight and dignity. A loss you carry slowly and quietly.",
    relatedIds: ['gloomy', 'grief', 'melancholy', 'forlorn'],
  },
  grief: {
    description: "The ache of losing someone or something you loved. It comes in waves, and the love has nowhere to go.",
    relatedIds: ['forlorn', 'sorrow', 'gloomy', 'hopeless'],
  },
  forlorn: {
    description: "Sad and alone with it, like someone left behind at the station. Nobody seems to be coming.",
    relatedIds: ['grief', 'hopeless', 'sorrow', 'heartbroken'],
  },
  despondent: {
    description: "Sunk low with the hope drained out. Even trying feels pointless right now.",
    relatedIds: ['depressed', 'hopeless', 'anguish', 'heartbroken'],
  },
  depressed: {
    description: "Heavy and flat, as if the color has drained out of things. Getting through the day takes everything.",
    relatedIds: ['despondent', 'anguish', 'hopeless', 'heartbroken'],
  },
  anguish: {
    description: "Pain so sharp it's hard to bear. Sadness at full force, tearing through you.",
    relatedIds: ['depressed', 'despondent', 'heartbroken', 'hopeless'],
  },
  // radial-intensity: numb cluster
  resistant: {
    description: "Something in you is digging in its heels. You don't want to go there, even if you can't say why.",
    relatedIds: ['indifferent', 'bored', 'aloof', 'uneasy'],
  },
  indifferent: {
    description: "It doesn't matter much either way. You can't find a reason to care right now.",
    relatedIds: ['resistant', 'aloof', 'empty', 'bored'],
  },
  aloof: {
    description: "Keeping yourself at arm's length. Cool, a little apart, not letting anyone too close.",
    relatedIds: ['empty', 'indifferent', 'resistant', 'distant'],
  },
  distant: {
    description: "Far away inside, even with people right here. Their voices reach you faintly, as if from another room.",
    relatedIds: ['empty', 'listless', 'removed', 'aloof'],
  },
  listless: {
    description: "No spark for anything. You drift from one thing to the next without any pull.",
    relatedIds: ['removed', 'distant', 'empty', 'numb'],
  },
  removed: {
    description: "Watching your own life from a step away. Your body is here; your feelings are somewhere else.",
    relatedIds: ['numb', 'listless', 'distant', 'withdrawn'],
  },
  withdrawn: {
    description: "Pulled back into yourself. Reaching out, or being reached, feels like too much right now.",
    relatedIds: ['numb', 'disconnected', 'removed', 'lethargic'],
  },
  lethargic: {
    description: "Heavy and slow, like moving through water. Your body won't get going.",
    relatedIds: ['numb', 'withdrawn', 'disconnected', 'shut-down'],
  },
  isolated: {
    description: "Cut off from everyone, whether you chose it or not. The quiet around you has grown thick.",
    relatedIds: ['disconnected', 'shut-down', 'withdrawn', 'lethargic'],
  },
  'shut-down': {
    description: "Everything inside went quiet to protect you. Feeling, talking, reaching out — all switched off for now.",
    relatedIds: ['disconnected', 'isolated', 'lethargic', 'withdrawn'],
  },
  // radial-intensity: shame cluster
  inhibited: {
    description: "Holding yourself back — your words, your laugh, the way you move — in case of how it lands.",
    relatedIds: ['self-conscious', 'embarrassed', 'weak', 'ashamed'],
  },
  'self-conscious': {
    description: "Suddenly aware of being seen. You notice your hands, your voice, how you might look to them.",
    relatedIds: ['embarrassed', 'inhibited', 'weak', 'ashamed'],
  },
  weak: {
    description: "Feeling you should be stronger than this and aren't. Easily knocked over right now.",
    relatedIds: ['embarrassed', 'ashamed', 'self-conscious', 'useless'],
  },
  useless: {
    description: "The sense that nothing you do helps or counts. Hard to see where you fit or what you add.",
    relatedIds: ['ashamed', 'mortified', 'weak', 'humiliated'],
  },
  mortified: {
    description: "Embarrassment so intense you want to disappear. The moment keeps replaying, and your cheeks keep burning.",
    relatedIds: ['humiliated', 'useless', 'worthless', 'ashamed'],
  },
  worthless: {
    description: "A deep ache of not mattering, of not being enough. From the inside, it can feel like the whole truth.",
    relatedIds: ['humiliated', 'mortified', 'useless', 'ashamed'],
  },
  // radial-intensity: guilt cluster
  sorry: {
    description: "Wishing you hadn't caused someone hurt or trouble, and wanting to make it right.",
    relatedIds: ['regret', 'remorseful', 'embarrassed'],
  },
  regret: {
    description: "Looking back at a choice and wishing you'd gone the other way. The road not taken keeps tugging.",
    relatedIds: ['remorseful', 'sorry', 'ashamed'],
  },
  remorseful: {
    description: "Deep, aching sorrow for harm you caused. You feel its full weight and wish you could undo it.",
    relatedIds: ['regret', 'sorry', 'ashamed'],
  },
  // radial-intensity: powerless cluster
  sensitive: {
    description: "Raw and easily touched. Small things land harder than they usually would.",
    relatedIds: ['victim', 'incapable', 'impotent', 'helpless'],
  },
  victim: {
    description: "The sense that life, or someone in it, is acting on you, and you're the one taking the hit.",
    relatedIds: ['sensitive', 'incapable', 'impotent', 'helpless'],
  },
  incapable: {
    description: "Facing something and feeling you don't have what it takes. The task looms larger than you.",
    relatedIds: ['victim', 'impotent', 'helpless', 'sensitive'],
  },
  impotent: {
    description: "You want to act, but your efforts don't land. You push and push, and nothing moves.",
    relatedIds: ['helpless', 'incapable', 'trapped', 'victim'],
  },
  trapped: {
    description: "No way out that you can see. Walls on every side, and every door seems shut.",
    relatedIds: ['helpless', 'resigned', 'impotent', 'incapable'],
  },
  // Added by the radial-spread / radial-clustered proposals
  glad: {
    description: "A small, simple yes. Something went the way you hoped, and you're pleased it did.",
    relatedIds: ['happy', 'delighted', 'enchanted'],
  },
  elated: {
    description: "Lifted clean off the ground. Joy so strong it feels like rising.",
    relatedIds: ['delighted', 'radiant', 'vibrant', 'happy'],
  },
  alert: {
    description: "Awake and tuned in. Your attention is sharp and ready, with no alarm in it.",
    relatedIds: ['refreshed', 'renewed', 'rejuvenated'],
  },
  astonished: {
    description: "Stopped in your tracks. Something so unexpected that, for a moment, you can't take it in.",
    relatedIds: ['shocked', 'surprised', 'questioning'],
  },
  miserable: {
    description: "Unhappy all the way through, with no part of you feeling okay right now.",
    relatedIds: ['unhappy', 'hurt', 'forlorn', 'sorrow'],
  },
  sleepy: {
    description: "Heavy-eyed and slow. Your body is asking to rest, and everything else can wait.",
    relatedIds: ['lethargic', 'numb', 'distant'],
  },
};

// Fallback for emotions without descriptions
export function getDescription(id: string): EmotionDescription {
  return descriptions[id] ?? {
    description: "A genuine feeling worth noticing.",
    relatedIds: [],
  };
}

// The definition the field's tooltip shows, or null when a word has none —
// no generic fallback, because the tooltip must never show filler text.
// scripts/test-definitions.ts keeps every active word covered.
export function definitionFor(id: string): string | null {
  const text = descriptions[id]?.description?.trim();
  return text ? text : null;
}

// The ids in `ids` that have no definition, in input order.
export function missingDefinitions(ids: string[]): string[] {
  return ids.filter((id) => definitionFor(id) === null);
}
