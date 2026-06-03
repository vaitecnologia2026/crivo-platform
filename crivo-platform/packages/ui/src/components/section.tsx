import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/** Seção da LP — porte de `.section` (padding 120px) + variantes de fundo. */
export const sectionVariants = cva("relative py-[120px]", {
  variants: {
    tone: {
      light: "bg-off-white text-azul-profundo",
      dark: "bg-azul-profundo text-off-white",
      accent: "bg-[linear-gradient(170deg,#102A52_0%,#0D1F3C_100%)] text-off-white",
      final:
        "text-off-white text-center bg-[radial-gradient(ellipse_at_center,rgba(74,111,165,0.2)_0%,transparent_60%),linear-gradient(180deg,#102A52_0%,#0D1F3C_100%)]",
    },
  },
  defaultVariants: { tone: "light" },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  id?: string;
}

export function Section({ tone, className, children, ...props }: SectionProps) {
  return (
    <section className={cn(sectionVariants({ tone }), className)} {...props}>
      {children}
    </section>
  );
}

/** Container central — max-width 1180px (narrow 860px), padding lateral 28px. */
export function Container({
  narrow,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { narrow?: boolean }) {
  return (
    <div
      className={cn("mx-auto px-7", narrow ? "max-w-[860px]" : "max-w-[1180px]", className)}
      {...props}
    >
      {children}
    </div>
  );
}
