import { cn } from "../lib/utils";

export interface VerticeProps extends React.SVGProps<SVGSVGElement> {
  /** Cor dos traços do triângulo. Default: azul-profundo (#0D1F3C). */
  stroke?: string;
  /** Cor do ponto do vértice (o ICD). Default: terra-dourado (#C4894A). */
  dot?: string;
  /** Cor do núcleo do ponto. Default: off-white (#F2F0EC). */
  core?: string;
}

/**
 * O Vértice — símbolo oficial da CRIVO™.
 * O triângulo NUNCA fecha (base aberta = sistema em movimento) e NUNCA aparece
 * sem o ponto terra (o ICD). Reproduz o favicon canônico (viewBox 0 0 48 44).
 */
export function Vertice({ stroke = "#0D1F3C", dot = "#C4894A", core = "#F2F0EC", className, ...props }: VerticeProps) {
  return (
    <svg viewBox="0 0 48 44" fill="none" aria-hidden="true" className={cn("block", className)} {...props}>
      <line x1="5" y1="37" x2="24" y2="6" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <line x1="43" y1="37" x2="24" y2="6" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <line x1="5" y1="37" x2="17" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <line x1="31" y1="37" x2="43" y2="37" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="6" r="4.2" fill={dot} />
      <circle cx="24" cy="6" r="1.8" fill={core} />
    </svg>
  );
}
