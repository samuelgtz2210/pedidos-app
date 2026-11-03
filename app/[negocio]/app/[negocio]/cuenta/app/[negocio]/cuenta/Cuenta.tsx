"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ETIQUETAS_ESTADO } from "@/lib/pedidos";
import LoginCliente from "@/components/LoginCliente";

const formatoMoneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function dinero(v: number) { return formatoMoneda.format(v); }

type ItemPedido = {
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  pedido_item_opciones: { grupo: string; nombre: string; precio_extra: number }[];
};
type PedidoCliente = {
  id: string;
  numero: number;
  estado: string;
  tipo_entrega: string;
  total: number;
  creado_en: string;
  pedido_items: ItemPedido[];
};
type Direccion = { id: string; etiqueta: string; direccion: string };

export default function Cuenta({ slug }: { slug: string }) {
  const [supabase] = useState(() => createClient());
  const [cargando, setCargando] = useState(true);
  const [usuario, setUsuario] = useState<{ id: string } | null>(null);
  const [negocioId, setNegocioId] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([]);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [etiquetaNueva, setEtiquetaNueva] = useState("Casa");
  const [direccionNueva, setDireccionNueva] = useState("");

  useEffect(() => {
    supabase.from("negocios").select("id").eq("slug", slug).maybeSingle().then(({ data }) => {
      setNegocioId(data?.id ?? null);
    });
  }, [supabase, slug]);

  async function cargarTodo(uid: string, negId: string) {
    const { data: ps } = await supabase
      .from("pedidos")
      .select("id, numero, estado, tipo_entrega, total, creado_en, pedido_items(nombre, cantidad, precio_unitario, pedido_item_opciones(grupo, nombre, precio_extra))")
      .eq("negocio_id", negId)
      .order("creado_en", { ascending: false });
    setPedidos((ps ?? []) as unknown as PedidoCliente[]);

    const { data: dirs } = await supabase
      .from("direcciones_guardadas")
      .select("id, etiqueta, direccion")
      .order("creado_en", { ascending: false });
    setDirecciones((dirs ?? []) as Direccion[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUsuario({ id: data.user.id });
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUsuario(session?.user ? { id: session.user.id } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (usuario && negocioId) cargarTodo(usuario.id, negocioId);
    if (!usuario) { setPedidos([]); setDirecciones([]); }
  }, [usuario, negocioId]);

  // Refresca cada 15s si hay un pedido activo
  useEffect(() => {
    const activo = pedidos.some((p) => !["entregado", "cancelado"].includes(p.estado));
    if (!activo || !usuario || !negocioId) return;
    const id = setInterval(() => cargarTodo(usuario.id, negocioId), 15000);
    return () => clearInterval(id);
  }, [pedidos, usuario, negocioId]);

  async function agregarDireccion() {
    if (!usuario || !direccionNueva.trim()) return;
    await supabase.from("direcciones_guardadas").insert({
      cliente_id: usuario.id,
      etiqueta: etiquetaNueva.trim() || "Mi dirección",
      direccion: direccionNueva.trim(),
    });
    setDireccionNueva("");
    if (negocioId) cargarTodo(usuario.id, negocioId);
  }

  async function borrarDireccion(id: string) {
    await supabase.from("direcciones_guardadas").delete().eq("id", id);
    if (usuario && negocioId) cargarTodo(usuario.id, negocioId);
  }

  if (cargando) return <p className="text-gray-500">Cargando...</p>;

  if (!usuario) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-bold">Mi cuenta</h1>
        <LoginCliente onLogin={() => {}} />
        <a href={`/${slug}`} className="mt-6 inline-block text-sm text-gray-500 underline">Volver al menú</a>
      </>
    );
  }

  const actual = pedidos.find((p) => !["entregado", "cancelado"].includes(p.estado));
  const historial = pedidos.filter((p) => p.id !== actual?.id);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <a href={`/${slug}`} className="text-sm text-gray-500 underline">Volver al menú</a>
      </div>

      {actual && (
        <section className="mb-8 rounded-lg border-2 border-black p-4">
          <p className="mb-1 text-sm font-medium text-gray-500">Pedido actual</p>
          <TarjetaPedido p={actual} />
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">Mis direcciones</h2>
        {direcciones.length === 0 && <p className="mb-3 text-sm text-gray-500">No tienes direcciones guardadas.</p>}
        <ul className="mb-3 space-y-2">
          {direcciones.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span><strong>{d.etiqueta}:</strong> {d.direccion}</span>
              <button onClick={() => borrarDireccion(d.id)} className="text-red-600">Borrar</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={etiquetaNueva} onChange={(e) => setEtiquetaNueva(e.target.value)} placeholder="Etiqueta" className="rounded-lg border p-2 sm:w-32" />
          <input value={direccionNueva} onChange={(e) => setDireccionNueva(e.target.value)} placeholder="Dirección completa" className="flex-1 rounded-lg border p-2" />
          <button onClick={agregarDireccion} className="rounded-lg bg-black px-4 py-2 text-white">Guardar</button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Historial de pedidos</h2>
        {historial.length === 0 ? (
          <p className="text-gray-500">Aún no tienes pedidos anteriores.</p>
        ) : (
          <ul className="space-y-3">
            {historial.map((p) => <li key={p.id}><TarjetaPedido p={p} /></li>)}
          </ul>
        )}
      </section>
    </>
  );
}

function TarjetaPedido({ p }: { p: PedidoCliente }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold">Pedido #{p.numero}</p>
        <span className="rounded-full border px-3 py-1 text-sm">{ETIQUETAS_ESTADO[p.estado] ?? p.estado}</span>
      </div>
      <p className="text-sm text-gray-500">{new Date(p.creado_en).toLocaleString("es-MX")}</p>
      <ul className="my-2 space-y-1 text-sm">
        {p.pedido_items.map((i, idx) => (
          <li key={idx}>
            {i.cantidad} × {i.nombre}
            {i.pedido_item_opciones.map((o, k) => (
              <span key={k} className="block text-gray-500">{o.grupo}: {o.nombre}</span>
            ))}
          </li>
        ))}
      </ul>
      <p className="font-bold">{dinero(Number(p.total))}</p>
    </div>
  );
}