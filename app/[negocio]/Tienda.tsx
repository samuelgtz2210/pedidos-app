"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Categoria = { id: string; nombre: string };
type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
};

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function dinero(valor: number) {
  return formatoMoneda.format(valor);
}

export default function Tienda({
  slug,
  nombre,
  categorias,
  productos,
}: {
  slug: string;
  nombre: string;
  categorias: Categoria[];
  productos: Producto[];
}) {
  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [clienteNombre, setClienteNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState<"domicilio" | "recoger">(
    "domicilio"
  );
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [confirmacion, setConfirmacion] = useState<{
    numero: number;
    total: number;
    tipo: "domicilio" | "recoger";
  } | null>(null);

  function agregar(id: string) {
    setCarrito((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  }

  function quitar(id: string) {
    setCarrito((c) => {
      const copia = { ...c };
      const nueva = (copia[id] ?? 0) - 1;
      if (nueva <= 0) delete copia[id];
      else copia[id] = nueva;
      return copia;
    });
  }

  const lineas = productos
    .filter((p) => carrito[p.id])
    .map((p) => ({
      ...p,
      precio: Number(p.precio),
      cantidad: carrito[p.id],
    }));

  const total = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
  const totalArticulos = lineas.reduce((suma, l) => suma + l.cantidad, 0);

  async function hacerPedido() {
    setError("");

    if (!clienteNombre.trim() || !telefono.trim()) {
      setError("Escribe tu nombre y tu teléfono.");
      return;
    }
    if (tipoEntrega === "domicilio" && !direccion.trim()) {
      setError("Escribe tu dirección de entrega.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { data, error: errorRpc } = await supabase.rpc("crear_pedido", {
      p_slug: slug,
      p_nombre: clienteNombre.trim(),
      p_telefono: telefono.trim(),
      p_tipo_entrega: tipoEntrega,
      p_direccion: tipoEntrega === "domicilio" ? direccion.trim() : null,
      p_metodo_pago: "efectivo",
      p_notas: notas.trim() || null,
      p_items: lineas.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })),
    });
    setEnviando(false);

    if (errorRpc || !data || data.length === 0) {
      console.error(errorRpc);
      setError("No pudimos enviar tu pedido. Intenta de nuevo.");
      return;
    }

    setConfirmacion({
      numero: Number(data[0].r_numero),
      total: Number(data[0].r_total),
      tipo: tipoEntrega,
    });
    setCarrito({});
  }

  if (confirmacion) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <h1 className="mb-2 text-2xl font-bold">¡Pedido recibido!</h1>
        <p className="mb-4 text-gray-500">
          {nombre} ya recibió tu pedido y empezará a prepararlo.
        </p>
        <p className="text-lg">
          Número de pedido: <strong>#{confirmacion.numero}</strong>
        </p>
        <p className="text-lg">
          Total a pagar: <strong>{dinero(confirmacion.total)}</strong>
        </p>
        <p className="mt-2 text-gray-500">
          Pagas en efectivo{" "}
          {confirmacion.tipo === "domicilio"
            ? "al recibir tu pedido."
            : "al recoger tu pedido."}
        </p>
        <button
          onClick={() => setConfirmacion(null)}
          className="mt-6 rounded-full bg-black px-6 py-3 text-white"
        >
          Hacer otro pedido
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold">{nombre}</h1>

      {categorias.map((cat) => (
        <section key={cat.id} className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">{cat.nombre}</h2>
          <ul className="divide-y rounded-lg border">
            {productos
              .filter((p) => p.categoria_id === cat.id)
              .map((p) => {
                const cantidad = carrito[p.id] ?? 0;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="font-medium">{p.nombre}</p>
                      {p.descripcion && (
                        <p className="text-sm text-gray-500">
                          {p.descripcion}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-medium">
                        {dinero(Number(p.precio))}
                      </p>
                    </div>

                    {cantidad === 0 ? (
                      <button
                        onClick={() => agregar(p.id)}
                        className="rounded-full bg-black px-4 py-2 text-sm text-white"
                      >
                        Agregar
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => quitar(p.id)}
                          className="h-8 w-8 rounded-full border text-lg"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="w-4 text-center">{cantidad}</span>
                        <button
                          onClick={() => agregar(p.id)}
                          className="h-8 w-8 rounded-full border text-lg"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <section id="pedido" className="mb-24">
        <h2 className="mb-3 text-xl font-semibold">Tu pedido</h2>
        {lineas.length === 0 ? (
          <p className="text-gray-500">Aún no has agregado productos.</p>
        ) : (
          <>
            <div className="rounded-lg border p-4">
              <ul className="space-y-2">
                {lineas.map((l) => (
                  <li key={l.id} className="flex justify-between gap-4">
                    <span>
                      {l.cantidad} × {l.nombre}
                    </span>
                    <span>{dinero(l.precio * l.cantidad)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
                <span>Total</span>
                <span>{dinero(total)}</span>
              </div>
            </div>

            <h2 className="mb-3 mt-8 text-xl font-semibold">Tus datos</h2>
            <div className="space-y-3">
              <input
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-lg border p-3"
              />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Tu teléfono (WhatsApp)"
                type="tel"
                className="w-full rounded-lg border p-3"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoEntrega("domicilio")}
                  className={`flex-1 rounded-lg border p-3 ${
                    tipoEntrega === "domicilio"
                      ? "bg-black text-white"
                      : ""
                  }`}
                >
                  A domicilio
                </button>
                <button
                  type="button"
                  onClick={() => setTipoEntrega("recoger")}
                  className={`flex-1 rounded-lg border p-3 ${
                    tipoEntrega === "recoger" ? "bg-black text-white" : ""
                  }`}
                >
                  Recoger
                </button>
              </div>

              {tipoEntrega === "domicilio" && (
                <textarea
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección completa (calle, número, colonia y referencias)"
                  rows={3}
                  className="w-full rounded-lg border p-3"
                />
              )}

              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas para el pedido (opcional)"
                rows={2}
                className="w-full rounded-lg border p-3"
              />

              <p className="text-sm text-gray-500">
                Forma de pago: efectivo{" "}
                {tipoEntrega === "domicilio"
                  ? "al recibir tu pedido."
                  : "al recoger tu pedido."}
              </p>

              {error && <p className="text-red-600">{error}</p>}

              <button
                onClick={hacerPedido}
                disabled={enviando}
                className="w-full rounded-full bg-black p-4 text-white disabled:opacity-50"
              >
                {enviando ? "Enviando..." : `Hacer pedido · ${dinero(total)}`}
              </button>
            </div>
          </>
        )}
      </section>

      {totalArticulos > 0 && (
        <a
          href="#pedido"
          className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 justify-between rounded-full bg-black px-6 py-4 text-white"
        >
          <span>Ver pedido ({totalArticulos})</span>
          <span>{dinero(total)}</span>
        </a>
      )}
    </>
  );
}