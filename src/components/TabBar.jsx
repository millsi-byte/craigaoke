import { LibraryIcon, UsersIcon, PlusIcon, GearIcon } from './icons.jsx';

const ACCENT = 'var(--color-accent)';
const IDLE = 'var(--color-neutral-600)';

const tabStyle = (active) => ({
  flex: 1,
  minHeight: 64,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  color: active ? ACCENT : IDLE,
});

const labelStyle = { fontSize: 10, letterSpacing: '0.1em', fontFamily: 'var(--font-heading)', fontWeight: 600 };

const TABS = [
  { key: 'library', label: 'LIBRARY', Icon: LibraryIcon, activeOn: ['library', 'detail'] },
  { key: 'artists', label: 'ARTISTS', Icon: UsersIcon, activeOn: ['artists'] },
  { key: 'add', label: 'ADD', Icon: PlusIcon, activeOn: ['add', 'edit'] },
  { key: 'settings', label: 'SETTINGS', Icon: GearIcon, activeOn: ['settings'] },
];

export default function TabBar({ screen, onGo }) {
  return (
    <nav
      style={{
        display: 'flex',
        borderTop: '2px solid var(--color-divider)',
        background: 'var(--color-bg)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ key, label, Icon, activeOn }) => (
        <button key={key} onClick={() => onGo(key)} style={tabStyle(activeOn.includes(screen))}>
          <Icon />
          <span style={labelStyle}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
