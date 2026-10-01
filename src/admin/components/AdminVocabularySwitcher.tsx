import { activeFrameworkId, frameworks, saveFrameworkId } from '../../data/frameworks';

// Which vocabulary the app's field, cards and tooltips use (and the
// Definitions page lists). Saved in this browser; open app tabs reload to pick
// it up, and this page reloads itself because it reads the same words. The
// Emotions editor is separate: it always edits the circumplex-custom source.
export function AdminVocabularySwitcher() {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ui-text-3)' }}>
      Vocabulary
      <select
        id="admin-vocabulary"
        value={activeFrameworkId}
        onChange={(e) => {
          saveFrameworkId(e.target.value);
          window.location.reload();
        }}
        style={{
          padding: '4px 6px',
          borderRadius: 5,
          border: '1px solid var(--ui-border)',
          background: 'var(--ui-bg)',
          color: 'var(--ui-text-1)',
          fontSize: 11,
          textTransform: 'none',
          letterSpacing: 0,
        }}
      >
        {Object.values(frameworks).map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </label>
  );
}
