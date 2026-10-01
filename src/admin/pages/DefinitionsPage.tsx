import { useEffect, useMemo, useState } from 'react';
import { emotions, type Emotion } from '../../data/emotions';
import { descriptions } from '../../data/descriptions';
import { describeWordRegion } from '../../components/EmotionField/definitionPlacement';
import { FLAGGED, NEWLY_WRITTEN_IDS } from '../lib/definitionReview';

// Read and edit the definitions the field's tooltip shows, for the words the
// app actually uses (the active framework). Grouped by cluster and ordered
// mild → intense, so neighbours read side by side. Saving rewrites only the
// edited entries in src/data/descriptions.ts (dev server only).

type Filter = 'all' | 'new' | 'flagged' | 'unreviewed';

const REVIEWED_KEY = 'constellation-admin-reviewed-definitions';
// The tooltip reads best at a sentence or two; past this the row says so.
const WORD_LIMIT = 25;
const FIELD_FONT = "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

function loadReviewed(): Set<string> {
  try {
    const raw = localStorage.getItem(REVIEWED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function storeReviewed(ids: Set<string>) {
  try {
    localStorage.setItem(REVIEWED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage blocked: review ticks just won't persist.
  }
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// Clusters in vocabulary order; words inside each from mildest to most intense.
const GROUPS: Array<{ cluster: string; words: Emotion[] }> = (() => {
  const order: string[] = [];
  const byCluster = new Map<string, Emotion[]>();
  for (const e of emotions) {
    if (!byCluster.has(e.cluster)) {
      order.push(e.cluster);
      byCluster.set(e.cluster, []);
    }
    byCluster.get(e.cluster)!.push(e);
  }
  return order.map((cluster) => ({
    cluster,
    words: byCluster.get(cluster)!.slice().sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)),
  }));
})();

export function DefinitionsPage() {
  const [filter, setFilter] = useState<Filter>('new');
  // Text the user has typed but not saved, and text saved this session (the
  // imported module may lag a save until HMR catches up).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState<Set<string>>(loadReviewed);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ kind: 'idle' });

  const baseline = (id: string) => saved[id] ?? descriptions[id]?.description ?? '';
  const valueOf = (id: string) => drafts[id] ?? baseline(id);
  const edited = Object.keys(drafts).filter((id) => drafts[id] !== baseline(id));
  const invalid = edited.filter((id) => drafts[id].trim() === '');

  // Don't lose typed edits to a stray reload or navigation.
  const hasEdits = edited.length > 0;
  useEffect(() => {
    if (!hasEdits) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasEdits]);

  const counts = useMemo(() => ({
    all: emotions.length,
    new: emotions.filter((e) => NEWLY_WRITTEN_IDS.has(e.id)).length,
    flagged: emotions.filter((e) => FLAGGED.has(e.id)).length,
    unreviewed: emotions.filter((e) => !reviewed.has(e.id)).length,
  }), [reviewed]);

  const shows = (e: Emotion) =>
    filter === 'all' ||
    (filter === 'new' && NEWLY_WRITTEN_IDS.has(e.id)) ||
    (filter === 'flagged' && FLAGGED.has(e.id)) ||
    (filter === 'unreviewed' && !reviewed.has(e.id));

  const toggleReviewed = (id: string) => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  // Persist outside the updater (StrictMode runs updaters twice).
  useEffect(() => storeReviewed(reviewed), [reviewed]);

  const save = async () => {
    const updates = Object.fromEntries(edited.map((id) => [id, drafts[id].trim()]));
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/admin-api/save-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      setSaved((prev) => ({ ...prev, ...updates }));
      setDrafts((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(updates)) delete next[id];
        return next;
      });
      setStatus({ kind: 'saved', message: `Saved ${edited.length} definition${edited.length === 1 ? '' : 's'}` });
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: 'new', label: `Written on this branch · ${counts.new}` },
    { id: 'flagged', label: `Flagged · ${counts.flagged}` },
    { id: 'unreviewed', label: `Not reviewed · ${counts.unreviewed}` },
    { id: 'all', label: `All · ${counts.all}` },
  ];

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 16px',
        padding: '12px 20px', background: 'var(--ui-surface)', borderBottom: '1px solid var(--ui-border)',
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '5px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                border: '1px solid var(--ui-border)',
                background: filter === f.id ? 'rgb(var(--ui-gold-rgb) / 0.14)' : 'transparent',
                color: filter === f.id ? 'var(--ui-gold)' : 'var(--ui-text-2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>
          {counts.all - counts.unreviewed} of {counts.all} reviewed
        </span>
        <span style={{ flex: 1 }} />
        {status.kind !== 'idle' && (
          <span style={{ fontSize: 11, color: status.kind === 'error' ? 'var(--ui-gold)' : 'var(--ui-text-2)' }}>
            {status.kind === 'saving' ? 'Saving…' : status.message}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={edited.length === 0 || invalid.length > 0 || status.kind === 'saving'}
          title={invalid.length > 0 ? 'A definition can’t be empty' : undefined}
          style={{
            padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: 'none', cursor: edited.length && !invalid.length ? 'pointer' : 'default',
            background: edited.length && !invalid.length ? 'var(--ui-gold)' : 'rgb(var(--ui-text-rgb) / 0.08)',
            color: edited.length && !invalid.length ? 'var(--ui-bg)' : 'var(--ui-text-3)',
          }}
        >
          {edited.length ? `Save ${edited.length} change${edited.length === 1 ? '' : 's'}` : 'No changes'}
        </button>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 980 }}>
        {GROUPS.map(({ cluster, words }) => {
          const visible = words.filter(shows);
          if (visible.length === 0) return null;
          return (
            <section key={cluster} style={{ marginTop: 22 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ui-text-3)' }}>
                {cluster} <span style={{ letterSpacing: 0 }}>· mild → intense</span>
              </h2>
              <div style={{ display: 'grid', gap: 6 }}>
                {visible.map((e) => {
                  const value = valueOf(e.id);
                  const isEdited = drafts[e.id] !== undefined && drafts[e.id] !== baseline(e.id);
                  const words = wordCount(value);
                  const flag = FLAGGED.get(e.id);
                  const isReviewed = reviewed.has(e.id);
                  return (
                    <div
                      key={e.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr) 116px', gap: 14, alignItems: 'start',
                        padding: '10px 12px', borderRadius: 8,
                        border: `1px solid ${isEdited ? 'var(--ui-gold-dim)' : 'var(--ui-border)'}`,
                        background: isReviewed ? 'transparent' : 'rgb(var(--ui-surface-rgb) / 0.6)',
                        opacity: isReviewed && !isEdited ? 0.6 : 1,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: FIELD_FONT, fontSize: 16, color: 'var(--ui-text-1)' }}>{e.label}</div>
                        <div style={{ marginTop: 3, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ui-text-3)' }}>
                          {describeWordRegion(e.x, e.y)} · {e.depth}
                        </div>
                        {(NEWLY_WRITTEN_IDS.has(e.id) || flag) && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {NEWLY_WRITTEN_IDS.has(e.id) && <Tag>new</Tag>}
                            {flag && <Tag tone="gold">flagged</Tag>}
                          </div>
                        )}
                      </div>
                      <div>
                        <textarea
                          id={`definition-${e.id}`}
                          aria-label={`Definition of ${e.label}`}
                          value={value}
                          rows={2}
                          onChange={(ev) => {
                            const text = ev.target.value;
                            setDrafts((prev) => ({ ...prev, [e.id]: text }));
                            if (status.kind !== 'saving') setStatus({ kind: 'idle' });
                          }}
                          style={{
                            width: '100%', boxSizing: 'border-box', resize: 'vertical', fieldSizing: 'content',
                            padding: '6px 8px', borderRadius: 6, border: '1px solid var(--ui-border)',
                            background: 'rgb(var(--ui-bg-rgb) / 0.5)', color: 'var(--ui-text-1)',
                            font: 'inherit', fontSize: 13, lineHeight: 1.5,
                          } as React.CSSProperties}
                        />
                        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10.5, color: 'var(--ui-text-3)' }}>
                          <span style={{ color: words > WORD_LIMIT ? 'var(--ui-gold)' : undefined }}>
                            {words} words{words > WORD_LIMIT ? ` · over ${WORD_LIMIT}` : ''}
                          </span>
                          {flag && <span>{flag}</span>}
                          {isEdited && (
                            <button
                              type="button"
                              onClick={() => setDrafts((prev) => {
                                const next = { ...prev };
                                delete next[e.id];
                                return next;
                              })}
                              style={{ marginLeft: 'auto', background: 'none', border: 'none', padding: 0, fontSize: 10.5, color: 'var(--ui-text-2)', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Revert
                            </button>
                          )}
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ui-text-2)', cursor: 'pointer', paddingTop: 4 }}>
                        <input type="checkbox" checked={isReviewed} onChange={() => toggleReviewed(e.id)} />
                        Reviewed
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'gold' }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 4, fontSize: 9.5, letterSpacing: '0.04em',
      border: `1px solid ${tone === 'gold' ? 'var(--ui-gold-dim)' : 'var(--ui-border)'}`,
      color: tone === 'gold' ? 'var(--ui-gold)' : 'var(--ui-text-3)',
    }}>
      {children}
    </span>
  );
}
