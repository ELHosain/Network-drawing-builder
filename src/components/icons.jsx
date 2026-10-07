import React from 'react';

// One icon set for the whole toolbar.
//
// The toolbar previously mixed emoji (floppy disk, folder, clipboard, padlock)
// with stroked SVG. Emoji are rendered by the OS font, so they arrive in full
// colour, at their own weight, and look different on Windows, macOS and
// Android -- next to a 1.7px monochrome stroke they read as clip-art dropped
// into a drawing tool. These all share one geometry: 24px box, 1.7 stroke,
// round caps and joins, and they inherit colour from the button, so a disabled
// or accented button carries its icon with it.
function Icon({ children, size = 13 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const UndoIcon = () => (
  <Icon><path d="M4 9h11a5 5 0 0 1 0 10h-6M4 9l4-4M4 9l4 4" /></Icon>
);

export const RedoIcon = () => (
  <Icon><path d="M20 9H9a5 5 0 0 0 0 10h6M20 9l-4-4M20 9l-4 4" /></Icon>
);

export const GridIcon = () => (
  <Icon>
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Icon>
);

export const LockIcon = ({ open }) => (
  <Icon>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    {open
      ? <path d="M8 11V7a4 4 0 0 1 7.5-2" />
      : <path d="M8 11V7a4 4 0 0 1 8 0v4" />}
  </Icon>
);

export const MinusIcon = () => <Icon><path d="M5 12h14" /></Icon>;
export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>;

export const FitIcon = () => (
  <Icon><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></Icon>
);

export const SaveIcon = () => (
  <Icon>
    <path d="M12 3v11M12 14l-4-4M12 14l4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

export const LoadIcon = () => (
  <Icon>
    <path d="M12 14V3M12 3L8 7M12 3l4 4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></Icon>
);

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6l7-3Z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Icon>
);

export const CameraIcon = () => (
  <Icon>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1-1.8A1.5 1.5 0 0 1 9.6 3.4h4.8a1.5 1.5 0 0 1 1.3.8l1 1.8h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" />
    <circle cx="12" cy="12.8" r="3.4" />
  </Icon>
);

export const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12M12 15l-4.5-4.5M12 15l4.5-4.5" />
    <path d="M4 20h16" />
  </Icon>
);

export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Icon>
);

export const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.7-.8 1.2v.4M12 16.5v.5" />
  </Icon>
);

export const SunIcon = () => (
  <Icon size={11}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </Icon>
);

export const MoonIcon = () => (
  <Icon size={11}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Icon>
);
