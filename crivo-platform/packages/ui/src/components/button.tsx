import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * Botão CRIVO™ — porte fiel de `.btn` da LP.
 * Base: uppercase, tracking 0.08em, radius 3px, borda 1px, transição 0.25s.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[3px] border border-transparent font-body font-normal uppercase tracking-[0.08em] whitespace-nowrap cursor-pointer transition-all duration-[250ms] disabled:opacity-60 disabled:cursor-default",
  {
    variants: {
      variant: {
        terra:
          "bg-terra text-off-white border-terra hover:bg-terra-escura hover:border-terra-escura hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(168,105,61,0.32)]",
        ghost:
          "bg-transparent text-off-white border-[rgba(242,240,236,0.28)] hover:border-terra-dourado hover:text-terra-dourado",
        outlineDark:
          "bg-transparent text-azul-profundo border-azul-profundo hover:bg-azul-profundo hover:text-off-white",
      },
      size: {
        default: "px-[30px] py-[15px] text-[13px]",
        sm: "px-[20px] py-[11px] text-[11px]",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "terra", size: "default", block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
