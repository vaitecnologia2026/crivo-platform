import { cn } from "../lib/utils";
import { Vertice } from "./vertice";

export interface BrandProps {
  /** Cor dos traços do Vértice. Default: off-white (uso sobre fundo escuro). */
  verticeStroke?: string;
  /** Mostra o subtítulo "Decision Intelligence". Default: true. */
  showSub?: boolean;
  className?: string;
}

/** Wordmark oficial CRIVO™ — Vértice + nome (Cormorant) + subtítulo. */
export function Brand({ verticeStroke = "#F2F0EC", showSub = true, className }: BrandProps) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Vertice stroke={verticeStroke} className="h-[34px] w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-word text-[24px] font-medium tracking-[0.22em] text-off-white">CRIVO</span>
        {showSub && (
          <span className="mt-[3px] font-body text-[8px] font-light uppercase tracking-[0.34em] text-azul-cobalto">
            Decision Intelligence
          </span>
        )}
      </span>
    </span>
  );
}
