import type { AdminEmotion } from '../types';
import { AdminMap } from '../components/AdminMap';
import { AdminTable } from '../components/AdminTable';

interface Props {
  emotions: AdminEmotion[];
  selectedId: string | null;
  visibleIds: Set<string> | null;
  depthFilter: Set<string>;
  clusterFilter: Set<string>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<AdminEmotion>) => void;
  onAdd: (label: string) => void;
  onRemove: (id: string) => void;
  onToggleDepth: (depth: string) => void;
  onToggleCluster: (cluster: string) => void;
}

// The vocabulary editor: circumplex map + row table, side by side. Split out
// of AdminApp so it can be routed to as its own page rather than always
// sharing the screen with reveal tuning and the theme picker.
export function EmotionsPage({
  emotions,
  selectedId,
  visibleIds,
  depthFilter,
  clusterFilter,
  onSelect,
  onUpdate,
  onAdd,
  onRemove,
  onToggleDepth,
  onToggleCluster,
}: Props) {
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <AdminMap
        emotions={emotions}
        selectedId={selectedId}
        visibleIds={visibleIds}
        onSelect={onSelect}
        onUpdate={onUpdate}
      />
      <AdminTable
        emotions={emotions}
        selectedId={selectedId}
        visibleIds={visibleIds}
        depthFilter={depthFilter}
        clusterFilter={clusterFilter}
        onSelect={onSelect}
        onUpdate={onUpdate}
        onAdd={onAdd}
        onRemove={onRemove}
        onToggleDepth={onToggleDepth}
        onToggleCluster={onToggleCluster}
      />
    </div>
  );
}
