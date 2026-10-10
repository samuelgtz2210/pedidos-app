"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  COLUMNAS_PEDIDO,
  ESTADOS_ACTIVOS,
  ETIQUETAS_ESTADO,
  type Pedido,
} from "@/lib/pedidos";

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function formatoHora(fecha: string) {
  return new Date(fecha).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function sonar(ctx: AudioContext) {
  [0, 0.35, 0.7].forEach((retraso) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + retraso;
    osc.start(t);
    osc.stop(t + 0.2);
  });
}

function siguientePaso(p: Pedido): { estado: string; texto: string } | null {
  switch (p.estado) {
    case "nuevo":
      return { estado: "preparando", texto: "Empezar a preparar" };
    case "preparando":
      return { estado: "listo", texto: "Marcar listo" };
    case "listo":
      return p.tipo_entrega === "domicilio"
        ? { estado: "en_camino", texto: "Salió a entrega" }
        : { estado: "entregado", texto: "Entregado al cliente" };
    case "en_camino":
      return { estado: "entregado", texto: "Marcar entregado" };
    default:
      return null;
  }
}

export default function PanelPedidos({
  negocioId,
  nombreNegocio,
  pedidosIniciales,
}: {
  negocioId: string;
  nombreNegocio: string;
  pedidosIniciales: Pedido[];
}) {
  const [supabase] = useState(() => createClient());
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciales);
  const [vista, setVista] = useState<"activos" | "terminados">("activos");
  const [sonidoActivo, setSonidoActivo] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [errorAccion, setErrorAccion] = useState("");
  const audioRef = useRef<AudioContext | null>(null);

  const recargar = useCallback(async () => {
    const { data } = await supabase
      .from("pedidos")
      .select(COLUMNAS_PEDIDO)
      .eq("negocio_id", negocioId)
      .order("creado_en", { ascending: false })
      .limit(50);
    if (data) setPedidos(data as unknown as Pedido[]);
  }, [supabase, negocioId]);

  useEffect(() => {
    const canal = supabase
      .channel(`pedidos-${negocioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
          filter: `negocio_id=eq.${negocioId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" && audioRef.current) {
            sonar(audioRef.current);
          }
          recargar();
        }
      )
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));

    // Respaldo: revisa cada 30 segundos por si se pierde la conexión en vivo
    const intervalo = setInterval(recargar, 30000);

    return () => {
      clearInterval(intervalo);
      supabase.removeChannel(canal);
    };
  }, [supabase, negocioId, recargar]);

  function activarSonido() {
    const ctx = new AudioContext();
    audioRef.current = ctx;
    sonar(ctx);
    setSonidoActivo(true);
  }

  async function cambiarEstado(id: string, estado: string) {
    setErrorAccion("");
    const { error } = await supabase
      .from("pedidos")
      .update({ estado })
      .eq("id", id);
    if (error) {
      setErrorAccion("No se pudo actualizar el pedido. Intenta de nuevo.");
      return;
    }
    setPedidos((ps) => ps.map((p) => (p.id === id ? { ...p, estado } : p)));
  }

  async function marcarPagado(id: string) {
    setErrorAccion("");
    const { error } = await supabase
      .from("pedidos")
      .update({ estado_pago: "pagado" })
      .eq("id", id);
    if (error) {
      setErrorAccion("No se pudo actualizar el pago. Intenta de nuevo.");
      return;
    }
    setPedidos((ps) =>
      ps.map((p) => (p.id === id ? { ...p, estado_pago: "pagado" } : p))
    );
  }

  function cancelar(p: Pedido) {
    if (window.confirm(`¿Cancelar el pedido #${p.numero}?`)) {
      cambiarEstado(p.id, "cancelado");
    }
  }

  function enlaceWhatsApp(p: Pedido) {
    const digitos = p.cliente_telefono.replace(/\D/g, "");
    const numero = digitos.length === 10 ? `52${digitos}` : digitos;
    const saludo = `Hola ${p.cliente_nombre}, `;
    let texto = `${saludo}te escribimos de ${nombreNegocio} sobre tu pedido #${p.numero}.`;

    if (p.estado === "preparando") {
      texto = `${saludo}ya estamos preparando tu pedido #${p.numero} de ${nombreNegocio}.`;
    } else if (p.estado === "listo") {
      texto =
        p.tipo_entrega === "domicilio"
          ? `${saludo}tu pedido #${p.numero} de ${nombreNegocio} ya está listo y saldrá a entrega en un momento.`
          : `${saludo}tu pedido #${p.numero} de ${nombreNegocio} ya está listo para recoger.`;
    } else if (p.estado === "en_camino") {
      texto = `${saludo}tu pedido #${p.numero} de ${nombreNegocio} ya va en camino.`;
    } else if (p.estado === "entregado") {
      texto = `${saludo}gracias por tu compra en ${nombreNegocio}. ¡Esperamos verte pronto!`;
    }

    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  const activos = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
  const terminados = pedidos.filter((p) => !ESTADOS_ACTIVOS.includes(p.estado));
  const visibles = vista === "activos" ? activos : terminados;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Pedidos · {nombreNegocio}</h1>
        <span className="text-sm text-gray-500">
          {conectado ? "● En vivo" : "○ Reconectando..."}
        </span>
      </div>

      {!sonidoActivo && (
        <button
          onClick={activarSonido}
          className="mb-6 w-full rounded-lg border-2 border-dashed p-3"
        >
          🔔 Toca aquí para activar el sonido de pedidos nuevos
        </button>
      )}

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setVista("activos")}
          className={`flex-1 rounded-lg border p-3 ${
            vista === "activos" ? "bg-black text-white" : ""
          }`}
        >
          Activos ({activos.length})
        </button>
        <button
          onClick={() => setVista("terminados")}
          className={`flex-1 rounded-lg border p-3 ${
            vista === "terminados" ? "bg-black text-white" : ""
          }`}
        >
          Terminados ({terminados.length})
        </button>
      </div>

      {errorAccion && <p className="mb-4 text-red-600">{errorAccion}</p>}

      {visibles.length === 0 ? (
        <p className="text-gray-500">No hay pedidos aquí.</p>
      ) : (
        <ul className="space-y-4">
          {visibles.map((p) => {
            const paso = siguientePaso(p);
            const puedeCancelar = ["nuevo", "preparando", "listo"].includes(
              p.estado
            );
            return (
              <li
                key={p.id}
                className={`rounded-lg border p-4 ${
                  p.estado === "nuevo" ? "border-2 border-red-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-lg font-bold">Pedido #{p.numero}</p>
                  <span className="rounded-full border px-3 py-1 text-sm">
                    {ETIQUETAS_ESTADO[p.estado] ?? p.estado}
                  </span>
                </div>

                <p className="text-sm text-gray-500" suppressHydrationWarning>
                  {formatoHora(p.creado_en)}
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
                  {p.pedido_items.map((i, idx) => (
                    <li key={idx}>
                      {i.cantidad} × {i.nombre}
                    </li>
                  ))}
                </ul>

                <p className="font-bold">
                  Total: {formatoMoneda.format(Number(p.total))} ·{" "}
                  {p.metodo_pago} ·{" "}
                  {p.estado_pago === "pagado" ? "Pagado" : "Pago pendiente"}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {paso && (
                    <button
                      onClick={() => cambiarEstado(p.id, paso.estado)}
                      className="rounded-full bg-black px-4 py-2 text-sm text-white"
                    >
                      {paso.texto}
                    </button>
                  )}
                  {p.estado_pago === "pendiente" && p.estado !== "cancelado" && (
                    <button
                      onClick={() => marcarPagado(p.id)}
                      className="rounded-full border px-4 py-2 text-sm"
                    >
                      Marcar como pagado
                    </button>
                  )}
                  <a
                    href={enlaceWhatsApp(p)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-4 py-2 text-sm"
                  >
                    WhatsApp al cliente
                  </a>
                  {puedeCancelar && (
                    <button
                      onClick={() => cancelar(p)}
                      className="rounded-full border border-red-500 px-4 py-2 text-sm text-red-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}