import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COLUMNAS_PEDIDO, type Pedido } from "@/lib/pedidos";
import PanelPedidos from "./PanelPedidos";

export default function PaginaPanel() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<p className="text-gray-500">Cargando panel...</p>}>
        <Panel />
      </Suspense>
    </main>
  );
}

async function Panel() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membresia } = await supabase
    .from("negocio_miembros")
    .select("negocio_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membresia) {
    return <p>Tu usuario no está asociado a ningún negocio.</p>;
  }

  const { data: negocio } = await supabase
    .from("negocios")
    .select("nombre")
    .eq("id", membresia.negocio_id)
    .maybeSingle();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(COLUMNAS_PEDIDO)
    .eq("negocio_id", membresia.negocio_id)
    .order("creado_en", { ascending: false })
    .limit(50);

  return (
    <PanelPedidos
      negocioId={membresia.negocio_id}
      nombreNegocio={negocio?.nombre ?? ""}
      pedidosIniciales={(pedidos ?? []) as unknown as Pedido[]}
    />
  );
}