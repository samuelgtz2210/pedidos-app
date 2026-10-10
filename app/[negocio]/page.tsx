import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Tienda, { type Producto } from "./Tienda";

type Props = { params: Promise<{ negocio: string }> };

type OpcionRaw = {
  id: string;
  nombre: string;
  precio_extra: number;
  orden: number;
  disponible: boolean;
};
type GrupoRaw = {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  orden: number;
  opciones: OpcionRaw[];
};
type ProductoRaw = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  producto_grupos: { grupos_opciones: GrupoRaw | null }[];
};

export default function PaginaNegocio({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <Suspense fallback={<p className="text-gray-500">Cargando menú...</p>}>
        <Menu params={params} />
      </Suspense>
    </main>
  );
}

async function Menu({ params }: Props) {
  await connection();
  const { negocio: slug } = await params;
  const supabase = await createClient();

  const { data: negocio } = await supabase
    .from("negocios")
    .select("id, nombre")
    .eq("slug", slug)
    .maybeSingle();

  if (!negocio) notFound();

  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("negocio_id", negocio.id)
    .order("orden");

  const { data: productosRaw } = await supabase
    .from("productos")
    .select(
      "id, categoria_id, nombre, descripcion, precio, producto_grupos(grupos_opciones(id, nombre, minimo, maximo, orden, opciones(id, nombre, precio_extra, orden, disponible)))"
    )
    .eq("negocio_id", negocio.id)
    .order("orden");

  const productos: Producto[] = (
    (productosRaw ?? []) as unknown as ProductoRaw[]
  ).map((p) => ({
    id: p.id,
    categoria_id: p.categoria_id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    grupos: p.producto_grupos
      .map((pg) => pg.grupos_opciones)
      .filter((g): g is GrupoRaw => g !== null)
      .sort((a, b) => a.orden - b.orden)
      .map((g) => ({
        id: g.id,
        nombre: g.nombre,
        minimo: g.minimo,
        maximo: g.maximo,
        opciones: g.opciones
          .filter((o) => o.disponible)
          .sort((a, b) => a.orden - b.orden)
          .map((o) => ({
            id: o.id,
            nombre: o.nombre,
            precio_extra: Number(o.precio_extra),
          })),
      })),
  }));

  return (
    <Tienda
      slug={slug}
      nombre={negocio.nombre}
      categorias={categorias ?? []}
      productos={productos}
    />
  );
}