import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geocodificar } from "@/lib/geocodificar";
import {
  calcularDistancia,
  redondearHaciaArriba,
  costoEnvio,
  enlaceGoogleMaps,
} from "@/lib/distancia";

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

// Valida que el teléfono tenga 10 dígitos (México)
function validarTelefono(telefono: string): boolean {
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length === 10;
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

  // Validaciones básicas
  if (!nombre || !telefono) {
    return NextResponse.json(
      { error: "Faltan tu nombre o teléfono." },
      { status: 400 }
    );
  }

  if (!validarTelefono(telefono)) {
    return NextResponse.json(
      { error: "Tu teléfono debe tener 10 dígitos." },
      { status: 400 }
    );
  }

  if (tipoEntrega === "domicilio" && !direccion) {
    return NextResponse.json(
      { error: "Falta tu dirección de entrega." },
      { status: 400 }
    );
  }

  let costoEnvioCalculado = 0;
  let latDestino: number | null = null;
  let lngDestino: number | null = null;
  let enlaceMaps: string | null = null;

  // Si es domicilio, calcula distancia y envío
  if (tipoEntrega === "domicilio") {
    // Geocodifica la dirección
    const coordenadas = await geocodificar(direccion);
    if (!coordenadas) {
      return NextResponse.json(
        {
          error:
            "No encontramos tu dirección. Intenta escribirla de otra forma o verifica que esté completa.",
        },
        { status: 400 }
      );
    }

    latDestino = coordenadas.lat;
    lngDestino = coordenadas.lng;

    // Origen: Parque Metropolitano, Zapopan
    const latOrigen = 20.6295;
    const lngOrigen = -103.3861;

    // Calcula distancia
    const distancia = await calcularDistancia(
      latOrigen,
      lngOrigen,
      latDestino,
      lngDestino
    );
    if (distancia === null) {
      return NextResponse.json(
        { error: "No pudimos calcular el envío. Intenta de nuevo." },
        { status: 502 }
      );
    }

    // Distancia máxima de entrega: 10 km
    if (distancia > 10) {
      return NextResponse.json(
        {
          error:
            "Tu dirección está muy lejos. Entregamos hasta 10 km de Parque Metropolitano.",
        },
        { status: 400 }
      );
    }

    // Redondea hacia arriba y calcula costo
    const kmRedondeados = redondearHaciaArriba(distancia);
    costoEnvioCalculado = costoEnvio(kmRedondeados);

    // Genera enlace de Google Maps
    enlaceMaps = enlaceGoogleMaps(
      "Parque Metropolitano",
      latOrigen,
      lngOrigen,
      latDestino,
      lngDestino
    );
  }

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
    p_costo_envio: costoEnvioCalculado,
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

  // Guarda coordenadas y enlace de maps
  if (tipoEntrega === "domicilio" && latDestino && lngDestino) {
    await supabase
      .from("pedidos")
      .update({
        lat_destino: latDestino,
        lng_destino: lngDestino,
        enlace_google_maps: enlaceMaps,
      })
      .eq("id", id);
  }

  if (metodoPago === "efectivo") {
    return NextResponse.json({ id, numero, total });
  }

  // Pago con tarjeta: se crea el enlace de pago
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

  const itemsMp = (
    (filas ?? []) as { nombre: string; cantidad: number; precio_unitario: number }[]
  ).map((f) => ({
    title: f.nombre,
    quantity: Number(f.cantidad),
    unit_price: Number(f.precio_unitario),
    currency_id: "MXN",
  }));

  if (costoEnvioCalculado > 0) {
    itemsMp.push({
      title: "Envío",
      quantity: 1,
      unit_price: costoEnvioCalculado,
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