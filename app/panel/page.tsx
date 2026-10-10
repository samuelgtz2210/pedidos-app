import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

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
    .select(
      "id, numero, estado, tipo_entrega, metodo_pago, estado_pago, cliente_nombre, cliente_telefono, direccion, notas, total, creado_en, pedido_items(nombre, cantidad, precio_unitario)"
    )
    .eq("negocio_id", membresia.negocio_id)
    .order("creado_en", { ascending: false })
    .limit(50);

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">
        Pedidos · {negocio?.nombre}
      </h1>

      {!pedidos || pedidos.length === 0 ? (
        <p className="text-gray-500">Aún no hay pedidos.</p>
      ) : (
        <ul className="space-y-4">
          {pedidos.map((p) => (
            <li key={p.id} className="rounded-lg border p-4">
              <div className="flex justify-between gap-4">
                <p className="text-lg font-bold">Pedido #{p.numero}</p>
                <p className="rounded-full border px-3 py-1 text-sm">
                  {p.estado}
                </p>
              </div>

              <p className="text-sm text-gray-500">
                {new Date(p.creado_en).toLocaleString("es-MX", {
                  timeZone: "America/Mexico_City",
                })}
              </p>

              <p className="mt-2">
                {p.cliente_nombre} · {p.cliente_telefono}
              </p>
              <p className="text-sm">
                {p.tipo_entrega === "domicilio"
                  ? `Domicilio: ${p.direccion}`
                  : "Para recoger"}
              </p>
              {p.notas && <p className="text-sm">Notas: {p.notas}</p>}

              <ul className="my-3 space-y-1 border-t pt-3">
                {p.pedido_items.map(
                  (
                    i: { nombre: string; cantidad: number },
                    idx: number
                  ) => (
                    <li key={idx}>
                      {i.cantidad} × {i.nombre}
                    </li>
                  )
                )}
              </ul>

              <p className="font-bold">
                Total: ${p.total} · {p.metodo_pago} ({p.estado_pago})
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}