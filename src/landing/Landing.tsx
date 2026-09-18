import { useEffect, useMemo, useState } from 'react';
import { emotions } from '../data/emotions';
import { getRegionDescription, nearbyEmotions } from '../data/regions';
import { AxisSlider } from '../components/EmotionPreview/AxisSlider';
import { WordTag } from '../components/EmotionPreview/WordTag';
import { MiniCircumplex } from '../components/DiaryHistory/MiniCircumplex';
import { WeekChart } from '../components/DiaryHistory/WeekChart';
import { GROUNDING_CUES } from '../data/groundingCues';
import type { DiaryEntry, PinEntry } from '../types';
import { useTheme } from '../config/theme';
import { SKY_LINES, SKY_PINS, litWordPins, nearestWordIds, pointToCoord, wordPosition } from './sky';
import type { SkyPoint } from './sky';

// The primary action is one slot so it can change later (sign up, add the
// extension, download the app) without touching the layout. Relative to this
// page, "./" is the app's own root.
const CTA = { label: 'Start a check-in', href: './' };

const START = { x: -0.4, y: 0.4 };

// --- viewport plumbing -------------------------------------------------------

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

function useViewport(): { w: number; h: number } {
  const read = () => ({ w: document.documentElement.clientWidth, h: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize(read()));
    };
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', on);
    };
  }, []);
  return size;
}

// The section nearest the middle of the viewport decides how many pins the sky
// has planted. Scrolling back up un-plants them, so the sky always matches
// where you are.
function useStage(): number {
  const [stage, setStage] = useState(1);
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-stage]'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setStage(Number((e.target as HTMLElement).dataset.stage));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return stage;
}

// --- the sky -----------------------------------------------------------------

function Sky({
  stage,
  narrow,
  planted,
  press,
}: {
  stage: number;
  narrow: boolean;
  planted: boolean;
  press: { point: SkyPoint; n: number } | null;
}) {
  const { w, h } = useViewport();
  const points = SKY_PINS.map((p) => (narrow ? p.narrow : p.wide));
  const owners = useMemo(() => litWordPins(points, emotions, narrow ? 2 : 3), [narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = planted ? stage : 0;
  // A press on the hero plants the visitor's own pin; the words nearest it
  // surface the same way the page's pins do. It goes quiet once you scroll on.
  const userPress = shown === 1 ? press : null;
  const userWords = useMemo(() => {
    if (!userPress) return new Map<string, number>();
    const { x, y } = pointToCoord(userPress.point);
    return new Map(nearestWordIds(x, y, emotions, narrow ? 2 : 3).map((id, i) => [id, i] as const));
  }, [userPress, narrow]);

  return (
    <div className="sky" aria-hidden="true" data-pins={shown} data-reveal={shown >= 4 ? 'true' : 'false'}>
      <div className="aura aura-a" />
      <div className="aura aura-b" />
      <div className="aura aura-c" />

      <div className="words">
        {emotions.map((e) => {
          const pos = wordPosition(e);
          const owner = owners.get(e.id);
          const userSlot = userWords.get(e.id);
          const lit = (owner !== undefined && owner.pin <= shown) || userSlot !== undefined;
          const slot = userSlot ?? owner?.slot;
          return (
            <span
              key={e.id}
              className="word"
              data-depth={e.depth}
              data-lit={lit}
              data-pin={owner?.pin}
              data-slot={slot}
              data-copy={!narrow && pos.left < 50}
              style={{
                left: `${pos.left}%`,
                top: `${pos.top}%`,
                transitionDelay: lit ? `${((owner?.pin ?? 1) - 1) * 0.05 + (slot ?? 0) * 0.18}s` : '0s',
              }}
            >
              <i className="word-dot" />
              <span className="word-label">{e.label.toLowerCase()}</span>
            </span>
          );
        })}
      </div>

      <svg className="lines" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {SKY_LINES.map(([a, b]) => {
          const pa = points[a - 1];
          const pb = points[b - 1];
          return (
            <line
              key={`${a}-${b}`}
              x1={(pa.left / 100) * w}
              y1={(pa.top / 100) * h}
              x2={(pb.left / 100) * w}
              y2={(pb.top / 100) * h}
              pathLength={1}
              data-edge={a === 1 || b === 1 ? 'hero' : undefined}
              data-on={shown >= Math.max(a, b) || (a === 5 && b === 1 && shown >= 5)}
            />
          );
        })}
      </svg>

      {points.map((p, i) => (
        <span
          key={i}
          className="pin"
          data-n={i + 1}
          data-on={shown >= i + 1}
          style={{ left: `${p.left}%`, top: `${p.top}%` }}
        >
          <span className="pin-ring" />
          <span className="pin-core" />
        </span>
      ))}

      {userPress && (
        <span
          key={userPress.n}
          className="pin pin-user"
          data-on="true"
          style={{ left: `${userPress.point.left}%`, top: `${userPress.point.top}%` }}
        >
          <span className="pin-ring" />
          <span className="pin-core" />
        </span>
      )}
    </div>
  );
}

// --- sample data -------------------------------------------------------------

// A made-up week for the real WeekChart. One day is left empty on purpose so
// the chart shows what a gap looks like. Labeled as sample wherever it appears.
function sampleWeek(): DiaryEntry[] {
  const pts: Array<[number, number] | null> = [
    [-0.2, 0.1],
    [0.1, -0.2],
    null,
    [-0.1, 0.5],
    [0.2, 0.15],
    [0.4, 0.3],
    [0.25, 0.45],
  ];
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const entries: DiaryEntry[] = [];
  pts.forEach((pt, i) => {
    if (!pt) return;
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const pin: PinEntry = {
      id: `sample-pin-${i}`,
      x: pt[0],
      y: pt[1],
      recognizedWords: [],
      regionDescription: getRegionDescription(pt[0], pt[1], emotions),
    };
    entries.push({ id: `sample-${i}`, timestamp: d.toISOString(), pins: [pin], sessionDurationMs: 0 });
  });
  return entries;
}

// --- page --------------------------------------------------------------------

function Cta({ large = false }: { large?: boolean }) {
  return (
    <a className={large ? 'btn btn-lg' : 'btn'} href={CTA.href}>
      {CTA.label}
    </a>
  );
}

function stripEmphasis(s: string): string {
  return s.replace(/\*/g, '');
}

export function Landing() {
  // Keeps the page on the admin-selected theme (and repaints it live).
  useTheme();
  const narrow = useMediaQuery('(max-width: 760px)');
  const stage = useStage();
  const [planted, setPlanted] = useState(false);
  const [press, setPress] = useState<{ point: SkyPoint; n: number } | null>(null);
  const [pin, setPin] = useState(START);
  const [named, setNamed] = useState<Set<string>>(new Set());
  const [week] = useState(sampleWeek);

  // The one authored moment: the hero's pin is planted just after load, and
  // the words nearest it surface. Every later pin repeats the same gesture.
  useEffect(() => {
    const t = window.setTimeout(() => setPlanted(true), 450);
    return () => window.clearTimeout(t);
  }, []);

  const region = useMemo(() => getRegionDescription(pin.x, pin.y, emotions), [pin]);
  const relational = stripEmphasis(region.relational);
  const suggestions = useMemo(() => nearbyEmotions(pin.x, pin.y, emotions, 5), [pin]);
  const chips = useMemo(() => {
    const ids = new Set<string>([...named, ...suggestions.map((s) => s.id)]);
    return emotions.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, label: e.label }));
  }, [named, suggestions]);

  const demoPin: PinEntry = useMemo(
    () => ({ id: 'demo', x: pin.x, y: pin.y, recognizedWords: [], regionDescription: region }),
    [pin, region],
  );

  // The hero says "press anywhere on the field", so it takes the press: the
  // sky is fixed behind it, which makes viewport position the field position.
  const onHeroPress = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    const w = document.documentElement.clientWidth;
    const h = window.innerHeight;
    setPress((prev) => ({
      point: { left: (e.clientX / w) * 100, top: (e.clientY / h) * 100 },
      n: (prev?.n ?? 0) + 1,
    }));
  };

  const toggle = (id: string) =>
    setNamed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="lp">
      <Sky stage={stage} narrow={narrow} planted={planted} press={press} />

      <header className="nav">
        <a className="mark" href="#top" aria-label="Constellation, back to top">
          <span className="mark-dot" />
          Constellation
        </a>
        <Cta />
      </header>

      <main id="top">
        <section className="hero" data-stage="1" onPointerDown={onHeroPress}>
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1>Feelings don’t need the right word.</h1>
              <p className="lede">
                Press anywhere on the field to place a point. That’s the whole check-in. Words are there if you want
                them.
              </p>
              <div className="actions">
                <Cta large />
                <span className="fine">Opens in your browser. No account needed.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" data-stage="2">
          <div className="wrap sec-grid sec-grid-left">
            <div className="sec-copy">
              <h2>
                A <span className="nb">check-in</span> is a point.
              </h2>
              <p>
                Press and release anywhere on the field. Left to right runs from calm to activated; bottom to top,
                from negative to positive. There’s no menu to open and no answer to get right, so where you land is
                the record.
              </p>
            </div>
            <div className="sec-demo">
              <div className="card">
                <div className="card-head">
                  <span>Sample check-in</span>
                </div>
                <div className="card-body">
                  <div className="readout">
                    <MiniCircumplex pins={[demoPin]} size={112} showAxes />
                    <div className="readout-text">
                      <p className="relational">{relational}</p>
                      <p className="narrative">{region.narrative}</p>
                    </div>
                  </div>
                  <div className="sliders">
                    <AxisSlider
                      labelLow="Calm"
                      labelHigh="Activated"
                      value={pin.x}
                      origin={START.x}
                      onDrag={(v) => setPin((p) => ({ ...p, x: v }))}
                      onCommit={(v) => setPin((p) => ({ ...p, x: v }))}
                      onCancel={() => setPin((p) => ({ ...p, x: START.x }))}
                    />
                    <AxisSlider
                      labelLow="Negative"
                      labelHigh="Positive"
                      value={pin.y}
                      origin={START.y}
                      onDrag={(v) => setPin((p) => ({ ...p, y: v }))}
                      onCommit={(v) => setPin((p) => ({ ...p, y: v }))}
                      onCancel={() => setPin((p) => ({ ...p, y: START.y }))}
                    />
                  </div>
                </div>
              </div>
              <p className="demo-note">Drag either slider. It’s the same control the app uses to adjust a point.</p>
            </div>
          </div>
        </section>

        <section className="sec" data-stage="3">
          <div className="wrap sec-grid sec-grid-left">
            <div className="sec-copy">
              <h2>Words are optional, never a test.</h2>
              <p>
                Words drift in as you linger, the ones closest to where you landed. Tap any that fit, or none at all.
                You can come back later and change your mind.
              </p>
            </div>
            <div className="sec-demo words-demo">
              <p className="sample-label">Sample check-in</p>
              <p className="relational">{relational}</p>
              <div className="chips" role="group" aria-label="Words near this point">
                {chips.map((c) => (
                  <WordTag key={c.id} label={c.label} named={named.has(c.id)} onToggle={() => toggle(c.id)} />
                ))}
              </div>
              <p className="chips-note">
                {named.size === 0
                  ? 'Dashed words are suggestions. Nothing here is required.'
                  : 'Solid words are ones you’ve named. Tap again to let one go.'}
              </p>
            </div>
          </div>
        </section>

        <section className="sec sec-diary" data-stage="4">
          <div className="wrap sec-grid sec-grid-left">
            <div className="sec-copy">
              <h2>The points add up.</h2>
              <p>
                Each check-in is saved as a coordinate. The diary reads a week of them back as a shape: where you tend
                to land, and how it moves. Everything stays on your device.
              </p>
            </div>
            <div className="sec-demo">
              <p className="sample-label">Sample week</p>
              <div className="diary-card">
                <WeekChart entries={week} />
                <div className="diary-points">
                  <MiniCircumplex pins={week.flatMap((e) => e.pins)} size={104} showAxes />
                  <p>The same week as points on the field.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="close" data-stage="5">
          <div className="wrap close-inner">
            <h2 className="cue">{GROUNDING_CUES[7]}</h2>
            <p className="close-sub">Then press anywhere.</p>
            <Cta large />
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-inner">
          <span>Constellation</span>
          <span>A quiet place to notice how you feel. Not a clinical tool: no scores, no wrong answers.</span>
        </div>
      </footer>
    </div>
  );
}
