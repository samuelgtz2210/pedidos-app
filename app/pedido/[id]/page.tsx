import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AutoRefresh from "./AutoRefresh";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string }>;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function describirEstado(estado: string, tipo: string) {
  switch (estado) {
    case "por_pagar":
      return "Esperando la confirmación de tu pago...";
    case "nuevo":
      return "Recibimos tu pedido. El negocio lo revisará en un momento.";
    case "preparando":
      return "Estamos preparando tu pedido.";
    case "listo":
      return tipo === "domicilio"
        ? "Tu pedido está listo y saldrá a entrega."
        : "Tu pedido está listo para recoger.";
    case "en_camino":
      return "Tu pedido va en camino.";
    case "entregado":
      return "Pedido entregado. ¡Gracias por tu compra!";
    case "cancelado":
      return "Este pedido fue cancelado.";
    default:
      return estado;
  }
}

export default function PaginaPedido({ params, searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-lg p-6">
      <Suspense fallback={<p className="text-gray-500">Cargando pedido...</p>}>
        <Pedido params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Pedido({ params, searchParams }: Props) {
  await connection();
  const { id } = await params;
  const { pago } = await searchParams;

  if (!UUID.test(id)) notFound();

  const supabase = createAdminClient();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "numero, estado, estado_pago, metodo_pago, tipo_entrega, total, negocios(nombre, slug)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const negocio = pedido.negocios as unknown as {
    nombre: string;
    slug: string;
  } | null;

  const terminado = ["entregado", "cancelado"].includes(pedido.estado);
  const pagoFallido = pedido.estado === "por_pagar" && pago === "error";

  return (
    <div className="rounded-lg border p-6">
      {!terminado && !pagoFallido && (
        <AutoRefresh cada={pedido.estado === "por_pagar" ? 4000 : 15000} />
      )}

      <p className="text-sm text-gray-500">{negocio?.nombre}</p>
      <h1 className="mb-4 text-2xl font-bold">Pedido #{pedido.numero}</h1>

      <p className="mb-4 text-lg">
        {pagoFallido
          ? "El pago no se completó. Puedes volver al menú e intentarlo de nuevo."
          : describirEstado(pedido.estado, pedido.tipo_entrega)}
      </p>

      <p>
        Total: <strong>{formatoMoneda.format(Number(pedido.total))}</strong>
      </p>
      <p className="text-sm text-gray-500">
        Pago con {pedido.metodo_pago} ·{" "}
        {pedido.estado_pago === "pagado" ? "pagado" : "pendiente"}
      </p>

      {negocio && (
        <a
          href={`/${negocio.slug}`}
          className="mt-6 inline-block rounded-full border px-5 py-2 text-sm"
        >
          Volver al menú
        </a>
      )}
    </div>
  );
}