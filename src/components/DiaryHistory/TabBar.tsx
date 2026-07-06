interface Props {
  active: 'day' | 'week';
  onChange: (tab: 'day' | 'week') => void;
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--oura-border)', padding: '0 20px' }}>
      {(['day', 'week'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: active === tab ? '1px solid var(--oura-gold)' : '1px solid transparent',
            color: active === tab ? 'var(--oura-gold)' : 'var(--oura-text-3)',
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '12px 16px 11px',
            cursor: 'pointer',
            marginBottom: -1,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
