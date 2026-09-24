// Ícones SVG de traço — substituem emojis/glifos de sistema na UI do portal.
// Regra do cliente: NUNCA emoji; sempre ícone SVG de traço herdando a cor do
// contexto (currentColor). Puramente apresentação — não altera nenhuma lógica.
import type { CSSProperties, ReactNode } from "react";

type IconProps = { size?: number; className?: string; style?: CSSProperties };

function Svg({ size = 16, className, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.5 13.5a4 4 0 005.7 0l2.3-2.3a4 4 0 00-5.7-5.7l-1.2 1.2" />
    <path d="M13.5 10.5a4 4 0 00-5.7 0l-2.3 2.3a4 4 0 005.7 5.7l1.2-1.2" />
  </Svg>
);
export const IconCheck = (p: IconProps) => (<Svg {...p}><path d="M5 13l4 4L19 7" /></Svg>);
export const IconCircle = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="8" /></Svg>);
export const IconPlay = (p: IconProps) => (<Svg {...p}><path d="M8 5.5l11 6.5-11 6.5z" /></Svg>);
export const IconClose = (p: IconProps) => (<Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>);
export const IconExternal = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-8.5 8.5" />
    <path d="M18 13.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5.5" />
  </Svg>
);
export const IconChevronDown = (p: IconProps) => (<Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>);
export const IconChevronRight = (p: IconProps) => (<Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>);
export const IconPaperclip = (p: IconProps) => (
  <Svg {...p}><path d="M21 11l-8.4 8.4a4.5 4.5 0 11-6.4-6.4l8.4-8.4a3 3 0 114.3 4.3l-8.5 8.5a1.5 1.5 0 11-2.1-2.1l7.8-7.8" /></Svg>
);
export const IconGrid = (p: IconProps) => (
  <Svg {...p}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></Svg>
);
export const IconDot = (p: IconProps) => (<Svg {...p}><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" /></Svg>);

// Fatia 6 — ícones das telas Academia / Mentorias / Radar / People Analytics
// (o protótipo usa lucide: PlayCircle, BookOpen, FileText, CalendarClock, Eye,
// Download, ShieldCheck, Settings2). Mesmo traço, cor do contexto.
export const IconPlayCircle = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" /><path d="M4 20.5V5.5" /><path d="M6.5 18H20" /></Svg>
);
export const IconFileText = (p: IconProps) => (
  <Svg {...p}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></Svg>
);
export const IconGraduation = (p: IconProps) => (
  <Svg {...p}><path d="M3 9l9-4 9 4-9 4z" /><path d="M7 11v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V11" /><path d="M21 9v5" /></Svg>
);
export const IconMic = (p: IconProps) => (
  <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0" /><path d="M12 18v3" /></Svg>
);
export const IconClock = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconCalendarClock = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M12 14v3l2 1" /></Svg>
);
export const IconEye = (p: IconProps) => (
  <Svg {...p}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const IconDownload = (p: IconProps) => (<Svg {...p}><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M4 20h16" /></Svg>);
export const IconShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.5 12l2 2 3.5-4" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>
);
export const IconPlus = (p: IconProps) => (<Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>);
export const IconRefresh = (p: IconProps) => (<Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v5h-5" /></Svg>);
export const IconUsers = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M17 13.5a6.5 6.5 0 014.5 6.5" /></Svg>
);
export const IconBuilding = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /><path d="M10.5 21v-3h3v3" /></Svg>
);
export const IconMapPin = (p: IconProps) => (
  <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Svg>
);
