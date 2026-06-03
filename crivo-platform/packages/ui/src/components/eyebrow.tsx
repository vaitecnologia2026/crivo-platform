import { cn } from "../lib/utils";

export interface EyebrowProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Variante terra-dourado (sobre fundo escuro). Default: false (cinza sec.). */
  terra?: boolean;
}

/**
 * Eyebrow — rótulo de seção com traço terra à esquerda.
 * Porte de `.eyebrow` (uppercase, tracking 0.3em, ::before linha 18px).
 */
export function Eyebrow({ terra, className, children, ...props }: EyebrowProps) {
  return (
    <span
      className={cn(
        "relative mb-[22px] inline-block pl-7 text-[11px] font-normal uppercase tracking-[0.3em]",
        "before:absolute before:left-0 before:top-1/2 before:h-px before:w-[18px] before:content-['']",
        terra ? "text-terra-dourado before:bg-terra-dourado" : "text-text-sec before:bg-terra",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
