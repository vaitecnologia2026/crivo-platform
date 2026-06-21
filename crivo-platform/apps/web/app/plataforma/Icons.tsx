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
