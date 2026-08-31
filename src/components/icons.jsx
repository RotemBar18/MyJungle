/* Minimal stroke icon set. Directional icons carry `flip-rtl` at the call site. */
const S = ({ children, ...p }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...p}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <S {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 10v9h12v-9" />
  </S>
);
export const IconLeaf = (p) => (
  <S {...p}>
    <path d="M5 19c0-7 5-13 14-14 1 9-3 15-9 15-2.5 0-5-.5-5-1Z" />
    <path d="M5 19 14 10" />
  </S>
);
export const IconPlus = (p) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const IconChart = (p) => (
  <S {...p}>
    <path d="M4 20V6M10 20v-7M16 20v-11M22 20H3" />
  </S>
);
export const IconGear = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.2 3H9.8l-.4 2.2a7.7 7.7 0 0 0-2.6 1.5l-2-.8-1.9 3.3 1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.7 7.7 0 0 0 2.6 1.5l.4 2.2h4.4l.4-2.2a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.9-3.3Z" />
  </S>
);
export const IconBack = (p) => (
  <S {...p}>
    <path d="M15 19 8 12l7-7" />
  </S>
);
export const IconChevron = (p) => (
  <S {...p}>
    <path d="M9 5l7 7-7 7" />
  </S>
);
export const IconSearch = (p) => (
  <S {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </S>
);
export const IconClose = (p) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </S>
);
export const IconDrop = (p) => (
  <S {...p}>
    <path d="M12 3.5c3.2 3.7 5.5 6.6 5.5 9.4A5.5 5.5 0 0 1 12 18.5a5.5 5.5 0 0 1-5.5-5.6c0-2.8 2.3-5.7 5.5-9.4Z" />
  </S>
);
export const IconCamera = (p) => (
  <S {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
    <circle cx="12" cy="13" r="3.3" />
  </S>
);
export const IconCheck = (p) => (
  <S {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </S>
);
export const IconTrash = (p) => (
  <S {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </S>
);
export const IconEdit = (p) => (
  <S {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m14 6 4 4" />
  </S>
);
export const IconStar = ({ filled, ...p }) => (
  <S {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z" />
  </S>
);
export const IconFilter = (p) => (
  <S {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </S>
);
export const IconRuler = (p) => (
  <S {...p}>
    <rect x="3" y="8" width="18" height="8" rx="2" />
    <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
  </S>
);
export const IconMore = (p) => (
  <S {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </S>
);
export const IconCloudOff = (p) => (
  <S {...p}>
    <path d="M17 18H7a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 9.2-2.6" />
    <path d="M3 3l18 18" />
  </S>
);
export const IconDownload = (p) => (
  <S {...p}>
    <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
  </S>
);
export const IconUpload = (p) => (
  <S {...p}>
    <path d="M12 20V9M8 12l4-4 4 4M5 5h14" />
  </S>
);

export const Logo = ({ size = 28, ...p }) => (
  <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" {...p}>
    <rect width="64" height="64" rx="15" fill="#1f4d35" />
    <path d="M46 15c2 15-2 26-9 31-6 4-13 4-17 2 1-6 4-13 9-18 5-5 11-11 17-15Z" fill="#81c88f" />
    <path
      d="M18 50 46 16M28 40h11M25 43v-11"
      stroke="#1f4d35"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
