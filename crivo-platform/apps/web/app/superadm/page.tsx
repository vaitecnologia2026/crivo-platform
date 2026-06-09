import type { Metadata } from "next";
import { SuperAdmin } from "./SuperAdmin";

export const metadata: Metadata = {
  title: "CRIVO™ · Painel da Plataforma",
  robots: { index: false, follow: false }, // control plane: fora dos buscadores
};

// Painel do Super Admin (control plane). Gestão global de empresas-cliente.
// Sessão isolada da plataforma de tenant (token próprio). Backend: /api/admin/*.
export default function SuperAdminPage() {
  return <SuperAdmin />;
}
