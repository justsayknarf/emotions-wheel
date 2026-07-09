import { useState, useCallback, useMemo } from 'react';
import { emotions as emotionData } from '../data/emotions';
import { descriptions } from '../data/descriptions';
import type { AdminEmotion } from './types';
import { AdminHeader } from './components/AdminHeader';
import { AdminMap } from './components/AdminMap';
import { AdminTable } from './components/AdminTable';
import { generateId } from './lib/idgen';

function initEmotions(): AdminEmotion[] {
  return emotionData.map(e => ({
    ...e,
    description: descriptions[e.id]?.description ?? '',
    relatedIds: descriptions[e.id]?.relatedIds ?? [],
  }));
}

export function AdminApp() {
  const [emotions, setEmotions] = useState<AdminEmotion[]>(initEmotions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [depthFilter, setDepthFilter] = useState<Set<string>>(new Set());
  const [clusterFilter, setClusterFilter] = useState<Set<string>>(new Set());

  const visibleIds = useMemo<Set<string> | null>(() => {
    const noDepth = depthFilter.size === 0;
    const noCluster = clusterFilter.size === 0;
    if (noDepth && noCluster) return null;
    return new Set(
      emotions
        .filter(e =>
          (noDepth || depthFilter.has(e.depth)) &&
          (noCluster || clusterFilter.has(e.cluster)),
        )
        .map(e => e.id),
    );
  }, [emotions, depthFilter, clusterFilter]);

  const toggleDepth = useCallback((depth: string) => {
    setDepthFilter(prev => {
      const next = new Set(prev);
      if (next.has(depth)) next.delete(depth); else next.add(depth);
      return next;
    });
  }, []);

  const toggleCluster = useCallback((cluster: string) => {
    setClusterFilter(prev => {
      const next = new Set(prev);
      if (next.has(cluster)) next.delete(cluster); else next.add(cluster);
      return next;
    });
  }, []);

  const updateEmotion = useCallback((id: string, patch: Partial<AdminEmotion>) => {
    setEmotions(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
    setDirty(true);
    setSaveStatus(s => s === 'error' ? 'idle' : s);
  }, []);

  const addEmotion = useCallback((label: string) => {
    const id = generateId(label);
    const newEmotion: AdminEmotion = {
      id,
      label,
      x: 0,
      y: 0,
      depth: 'surface',
      cluster: 'new',
      description: '',
      relatedIds: [],
    };
    setEmotions(prev => [...prev, newEmotion]);
    setSelectedId(id);
    setDirty(true);
  }, []);

  const removeEmotion = useCallback((id: string) => {
    setEmotions(prev => prev.filter(e => e.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const res = await fetch('/admin-api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emotions }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      setSaveStatus('saved');
      setDirty(false);
      setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [emotions]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: 'var(--oura-bg)',
      color: 'var(--oura-text-1)',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden',
    }}>
      <AdminHeader
        dirty={dirty}
        saveStatus={saveStatus}
        saveError={saveError}
        onSave={handleSave}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <AdminMap
          emotions={emotions}
          selectedId={selectedId}
          visibleIds={visibleIds}
          onSelect={setSelectedId}
          onUpdate={updateEmotion}
        />
        <AdminTable
          emotions={emotions}
          selectedId={selectedId}
          visibleIds={visibleIds}
          depthFilter={depthFilter}
          clusterFilter={clusterFilter}
          onSelect={setSelectedId}
          onUpdate={updateEmotion}
          onAdd={addEmotion}
          onRemove={removeEmotion}
          onToggleDepth={toggleDepth}
          onToggleCluster={toggleCluster}
        />
      </div>
    </div>
  );
}
