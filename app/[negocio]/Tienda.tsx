"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Opcion = { id: string; nombre: string; precio_extra: number };
export type Grupo = {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  opciones: Opcion[];
};
export type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  grupos: Grupo[];
};

type Categoria = { id: string; nombre: string };
type OpcionElegida = Opcion & { grupo: string };
type Linea = {
  clave: string;
  producto: Producto;
  opciones: OpcionElegida[];
  cantidad: number;
};

const formatoMoneda = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function dinero(valor: number) {
  return formatoMoneda.format(valor);
}

function claveLinea(productoId: string, opciones: { id: string }[]) {
  return `${productoId}|${opciones
    .map((o) => o.id)
    .sort()
    .join(",")}`;
}

function precioUnitario(l: Linea) {
  return l.producto.precio + l.opciones.reduce((s, o) => s + o.precio_extra, 0);
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
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [configurando, setConfigurando] = useState<Producto | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
  const [errorOpciones, setErrorOpciones] = useState("");

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

  function agregarLinea(producto: Producto, opciones: OpcionElegida[]) {
    const clave = claveLinea(producto.id, opciones);
    setLineas((ls) => {
      const existe = ls.find((l) => l.clave === clave);
      if (existe) {
        return ls.map((l) =>
          l.clave === clave ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [...ls, { clave, producto, opciones, cantidad: 1 }];
    });
  }

  function cambiarCantidad(clave: string, delta: number) {
    setLineas((ls) =>
      ls
        .map((l) =>
          l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l
        )
        .filter((l) => l.cantidad > 0)
    );
  }

  function cantidadDe(productoId: string) {
    return lineas
      .filter((l) => l.producto.id === productoId)
      .reduce((s, l) => s + l.cantidad, 0);
  }

  function pulsarAgregar(p: Producto) {
    if (p.grupos.length === 0) {
      agregarLinea(p, []);
      return;
    }
    setSeleccion({});
    setErrorOpciones("");
    setConfigurando(p);
  }

  function elegirOpcion(grupo: Grupo, opcionId: string) {
    setErrorOpciones("");
    setSeleccion((s) => {
      const actuales = s[grupo.id] ?? [];
      if (grupo.maximo === 1) return { ...s, [grupo.id]: [opcionId] };
      if (actuales.includes(opcionId)) {
        return { ...s, [grupo.id]: actuales.filter((id) => id !== opcionId) };
      }
      if (actuales.length >= grupo.maximo) return s;
      return { ...s, [grupo.id]: [...actuales, opcionId] };
    });
  }

  function confirmarOpciones() {
    if (!configurando) return;
    for (const g of configurando.grupos) {
      const n = (seleccion[g.id] ?? []).length;
      if (n < g.minimo) {
        setErrorOpciones(`Falta elegir: ${g.nombre}.`);
        return;
      }
    }
    const elegidas = configurando.grupos.flatMap((g) =>
      g.opciones
        .filter((o) => (seleccion[g.id] ?? []).includes(o.id))
        .map((o) => ({ ...o, grupo: g.nombre }))
    );
    agregarLinea(configurando, elegidas);
    setConfigurando(null);
  }

  const total = lineas.reduce((s, l) => s + precioUnitario(l) * l.cantidad, 0);
  const totalArticulos = lineas.reduce((s, l) => s + l.cantidad, 0);

  const extrasSeleccion = configurando
    ? configurando.grupos
        .flatMap((g) =>
          g.opciones.filter((o) => (seleccion[g.id] ?? []).includes(o.id))
        )
        .reduce((s, o) => s + o.precio_extra, 0)
    : 0;

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
      p_items: lineas.map((l) => ({
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        opciones: l.opciones.map((o) => o.id),
      })),
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
    setLineas([]);
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
                const cantidad = cantidadDe(p.id);
                const sinOpciones = p.grupos.length === 0;
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
                        {dinero(p.precio)}
                      </p>
                    </div>

                    {sinOpciones && cantidad > 0 ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            cambiarCantidad(claveLinea(p.id, []), -1)
                          }
                          className="h-8 w-8 rounded-full border text-lg"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="w-4 text-center">{cantidad}</span>
                        <button
                          onClick={() =>
                            cambiarCantidad(claveLinea(p.id, []), 1)
                          }
                          className="h-8 w-8 rounded-full border text-lg"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => pulsarAgregar(p)}
                          className="rounded-full bg-black px-4 py-2 text-sm text-white"
                        >
                          Agregar
                        </button>
                        {cantidad > 0 && (
                          <span className="text-xs text-gray-500">
                            {cantidad} en tu pedido
                          </span>
                        )}
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
              <ul className="space-y-4">
                {lineas.map((l) => (
                  <li
                    key={l.clave}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p>{l.producto.nombre}</p>
                      {l.opciones.map((o) => (
                        <p key={o.id} className="text-sm text-gray-500">
                          {o.grupo}: {o.nombre}
                          {o.precio_extra > 0
                            ? ` (+${dinero(o.precio_extra)})`
                            : ""}
                        </p>
                      ))}
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => cambiarCantidad(l.clave, -1)}
                          className="h-7 w-7 rounded-full border"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <span className="w-4 text-center">{l.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(l.clave, 1)}
                          className="h-7 w-7 rounded-full border"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <span>{dinero(precioUnitario(l) * l.cantidad)}</span>
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
                    tipoEntrega === "domicilio" ? "bg-black text-white" : ""
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

      {totalArticulos > 0 && !configurando && (
        <a
          href="#pedido"
          className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 justify-between rounded-full bg-black px-6 py-4 text-white"
        >
          <span>Ver pedido ({totalArticulos})</span>
          <span>{dinero(total)}</span>
        </a>
      )}

      {configurando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => setConfigurando(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 text-black sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">{configurando.nombre}</h3>
            {configurando.descripcion && (
              <p className="text-sm text-gray-500">
                {configurando.descripcion}
              </p>
            )}

            {configurando.grupos.map((g) => (
              <fieldset key={g.id} className="mt-5">
                <legend className="font-semibold">{g.nombre}</legend>
                <p className="mb-2 text-sm text-gray-500">
                  {g.minimo >= 1 ? "Obligatorio" : "Opcional"}
                  {g.maximo > 1 ? ` · hasta ${g.maximo}` : ""}
                </p>
                <div className="space-y-2">
                  {g.opciones.map((o) => {
                    const actuales = seleccion[g.id] ?? [];
                    const elegida = actuales.includes(o.id);
                    const lleno =
                      g.maximo > 1 && !elegida && actuales.length >= g.maximo;
                    return (
                      <label
                        key={o.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                          lleno ? "opacity-50" : ""
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type={g.maximo === 1 ? "radio" : "checkbox"}
                            name={g.id}
                            checked={elegida}
                            disabled={lleno}
                            onChange={() => elegirOpcion(g, o.id)}
                          />
                          {o.nombre}
                        </span>
                        <span className="text-sm text-gray-500">
                          {o.precio_extra > 0
                            ? `+${dinero(o.precio_extra)}`
                            : "Incluido"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {errorOpciones && (
              <p className="mt-4 text-red-600">{errorOpciones}</p>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfigurando(null)}
                className="flex-1 rounded-full border p-3"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarOpciones}
                className="flex-[2] rounded-full bg-black p-3 text-white"
              >
                Agregar · {dinero(configurando.precio + extrasSeleccion)}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}