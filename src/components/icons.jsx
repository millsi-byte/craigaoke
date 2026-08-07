// Lucide icons (lucide.dev) inlined as SVG, per the design system.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' };

export const SearchIcon = (props) => (
  <svg width="18" height="18" {...base} {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const LibraryIcon = (props) => (
  <svg width="22" height="22" {...base} {...props}>
    <path d="M16 6l4 14M12 6v14M8 8v12M4 4v16" />
  </svg>
);

export const UsersIcon = (props) => (
  <svg width="22" height="22" {...base} {...props}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const PlusIcon = (props) => (
  <svg width="22" height="22" {...base} strokeWidth={2.5} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const GearIcon = (props) => (
  <svg width="20" height="20" {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const PlayIcon = ({ size = 12, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <polygon points="6 3 20 12 6 21" />
  </svg>
);

export const PauseIcon = ({ size = 20, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const HeartIcon = ({ filled = false, size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} {...props}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const BackIcon = (props) => (
  <svg width="24" height="24" {...base} strokeWidth={2.5} {...props}>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const ExternalIcon = (props) => (
  <svg width="13" height="13" {...base} {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export const XIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} {...base} strokeWidth={2.5} {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ClipboardIcon = (props) => (
  <svg width="16" height="16" {...base} {...props}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

export const GridIcon = ({ size = 18, ...props }) => (
  <svg width={size} height={size} {...base} {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
);

export const ListIcon = ({ size = 18, ...props }) => (
  <svg width={size} height={size} {...base} {...props}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export const ChevronDownIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} {...base} {...props}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const MetronomeIcon = (props) => (
  <svg width="18" height="18" {...base} {...props}>
    <path d="M12 2 7 20h10L12 2z" />
    <line x1="5" y1="16" x2="19" y2="16" />
    <line x1="12" y1="8" x2="16" y2="13" />
  </svg>
);
