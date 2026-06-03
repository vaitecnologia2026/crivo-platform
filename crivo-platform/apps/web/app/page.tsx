import { Plataforma } from "./plataforma/Plataforma";

// A plataforma é, hoje, o protótipo navegável (login → shell com 10 telas).
// As telas serão progressivamente ligadas à API (apps/api) e refatoradas em
// componentes @crivo/ui conforme forem para produção.
export default function Home() {
  return <Plataforma />;
}
