import { type AdminRoute } from '../lib/useAdminRoute';

interface Props {
  route: AdminRoute;
  onNavigate: (route: AdminRoute) => void;
}

const ITEMS: { route: AdminRoute; label: string }[] = [
  { route: 'emotions', label: 'Emotions' },
  { route: 'reveal', label: 'Reveal tuning' },
  { route: 'themes', label: 'Color themes' },
];

export function AdminNav({ route, onNavigate }: Props) {
  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 172,
        flexShrink: 0,
        padding: '14px 10px',
        gap: 2,
        borderRight: '1px solid var(--ui-border)',
        background: 'var(--ui-surface)',
        overflow: 'auto',
      }}
    >
      {ITEMS.map((item) => {
        const active = item.route === route;
        return (
          <button
            key={item.route}
            type="button"
            onClick={() => onNavigate(item.route)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '9px 10px',
              borderRadius: 6,
              border: 'none',
              background: active ? 'rgba(201,168,124,0.14)' : 'transparent',
              color: active ? 'var(--ui-gold)' : 'var(--ui-text-2)',
              fontSize: 12,
              fontWeight: active ? 500 : 400,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
