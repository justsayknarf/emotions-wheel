interface Props {
  dirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError: string | null;
  onSave: () => void;
}

export function AdminHeader({ dirty, saveStatus, saveError, onSave }: Props) {
  const label =
    saveStatus === 'saving' ? 'Saving…'
    : saveStatus === 'saved' ? 'Saved'
    : saveStatus === 'error' ? 'Error'
    : 'Save';

  const canSave = dirty && saveStatus !== 'saving';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      borderBottom: '1px solid var(--oura-border)',
      background: 'var(--oura-surface)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <a
          href="/emotions-wheel/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: 'var(--oura-text-3)',
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: 5,
            border: '1px solid var(--oura-border)',
          }}
        >
          ← App
        </a>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--oura-gold-dim)', marginBottom: 2 }}>Admin</div>
          <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--oura-text-1)' }}>Emotion Editor</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {saveError && (
          <div style={{ fontSize: 11, color: '#e57373', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {saveError}
          </div>
        )}
        {dirty && saveStatus !== 'saving' && saveStatus !== 'error' && (
          <div style={{ fontSize: 10, color: 'var(--oura-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unsaved</div>
        )}
        <button
          onClick={onSave}
          disabled={!canSave}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: 'none',
            background: canSave ? 'var(--oura-gold)' : 'var(--oura-border)',
            color: canSave ? '#0D0F14' : 'var(--oura-text-3)',
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: canSave ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
