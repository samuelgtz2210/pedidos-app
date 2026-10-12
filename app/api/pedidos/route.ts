import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ItemEntrada = {
  producto_id: string;
  cantidad: number;
  opciones: string[];
};

function texto(valor: unknown, max: number) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

function leerItems(valor: unknown): ItemEntrada[] {
  if (!Array.isArray(valor)) return [];
  return valor.slice(0, 50).map((i: unknown) => {
    const fila = (i ?? {}) as Record<string, unknown>;
    return {
      producto_id: texto(fila.producto_id, 64),
      cantidad: Number(fila.cantidad),
      opciones: Array.isArray(fila.opciones)
        ? fila.opciones.slice(0, 20).map((o: unknown) => texto(o, 64))
        : [],
    };
  });
}

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const slug = texto(cuerpo.slug, 60);
  const nombre = texto(cuerpo.nombre, 80);
  const telefono = texto(cuerpo.telefono, 20);
  const direccion = texto(cuerpo.direccion, 300);
  const notas = texto(cuerpo.notas, 300);
  const tipoEntrega =
    cuerpo.tipoEntrega === "recoger" ? "recoger" : "domicilio";
  const metodoPago = cuerpo.metodoPago === "tarjeta" ? "tarjeta" : "efectivo";
  const items = leerItems(cuerpo.items);

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("crear_pedido", {
    p_slug: slug,
    p_nombre: nombre,
    p_telefono: telefono,
    p_tipo_entrega: tipoEntrega,
    p_direccion: tipoEntrega === "domicilio" ? direccion : null,
    p_metodo_pago: metodoPago,
    p_notas: notas || null,
    p_items: items,
    p_costo_envio: 0,
  });

  if (error || !data || data.length === 0) {
    console.error("crear_pedido falló:", error);
    return NextResponse.json(
      { error: "No pudimos crear tu pedido. Revisa tus datos e intenta de nuevo." },
      { status: 400 }
    );
  }

  const pedido = data[0] as {
    r_pedido_id: string;
    r_numero: number;
    r_total: number;
  };
  const id = pedido.r_pedido_id;
  const numero = Number(pedido.r_numero);
  const total = Number(pedido.r_total);

  if (metodoPago === "efectivo") {
    return NextResponse.json({ id, numero, total });
  }

  // Pago con tarjeta: se crea el enlace de pago con los precios de la base de datos
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    console.error("Falta MERCADOPAGO_ACCESS_TOKEN");
    return NextResponse.json(
      { error: "El pago con tarjeta no está disponible por ahora." },
      { status: 500 }
    );
  }

  const { data: filas } = await supabase
    .from("pedido_items")
    .select("nombre, cantidad, precio_unitario")
    .eq("pedido_id", id);

  const { data: cabecera } = await supabase
    .from("pedidos")
    .select("costo_envio")
    .eq("id", id)
    .maybeSingle();

  const itemsMp = (
    (filas ?? []) as { nombre: string; cantidad: number; precio_unitario: number }[]
  ).map((f) => ({
    title: f.nombre,
    quantity: Number(f.cantidad),
    unit_price: Number(f.precio_unitario),
    currency_id: "MXN",
  }));

  const envio = Number(cabecera?.costo_envio ?? 0);
  if (envio > 0) {
    itemsMp.push({
      title: "Envío",
      quantity: 1,
      unit_price: envio,
      currency_id: "MXN",
    });
  }

  const origen = request.nextUrl.origin;

  const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: itemsMp,
      external_reference: id,
      back_urls: {
        success: `${origen}/pedido/${id}?pago=ok`,
        failure: `${origen}/pedido/${id}?pago=error`,
        pending: `${origen}/pedido/${id}?pago=pendiente`,
      },
      auto_return: "approved",
      notification_url: `${origen}/api/mercadopago/webhook`,
      binary_mode: true,
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "atm" },
          { id: "bank_transfer" },
        ],
      },
    }),
  });

  const preferencia = await respuesta.json();

  if (!respuesta.ok || !preferencia.init_point) {
    console.error("Mercado Pago rechazó la preferencia:", preferencia);
    return NextResponse.json(
      { error: "No pudimos iniciar el pago. Intenta de nuevo." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    id,
    numero,
    total,
    urlPago: preferencia.init_point,
  });
}