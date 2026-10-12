import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const url = new URL(request.url);
  let cuerpo: { type?: string; data?: { id?: string | number } } = {};
  try {
    cuerpo = await request.json();
  } catch {
    // Mercado Pago a veces manda los datos solo en la dirección
  }

  const tipo = url.searchParams.get("type") ?? cuerpo.type;
  const paymentId =
    url.searchParams.get("data.id") ??
    (cuerpo.data?.id !== undefined ? String(cuerpo.data.id) : null);

  if (tipo !== "payment" || !paymentId) {
    return NextResponse.json({ ok: true });
  }

  // No confiamos en el aviso: consultamos el pago directo a Mercado Pago
  const respuesta = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!respuesta.ok) {
    console.error("No se pudo consultar el pago", paymentId, respuesta.status);
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  const pago = await respuesta.json();
  if (pago.status !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const pedidoId = String(pago.external_reference ?? "");
  const supabase = createAdminClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, total, metodo_pago")
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido || pedido.metodo_pago !== "tarjeta") {
    return NextResponse.json({ ok: true });
  }

  if (Math.abs(Number(pedido.total) - Number(pago.transaction_amount)) > 0.01) {
    console.error("El monto pagado no coincide con el pedido", pedidoId);
    return NextResponse.json({ ok: true });
  }

  // Solo cambia si sigue "por_pagar": así un aviso repetido no hace nada
  await supabase
    .from("pedidos")
    .update({
      estado: "nuevo",
      estado_pago: "pagado",
      mp_payment_id: String(pago.id),
    })
    .eq("id", pedido.id)
    .eq("estado", "por_pagar");

  return NextResponse.json({ ok: true });
}