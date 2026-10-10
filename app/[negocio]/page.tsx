import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Tienda from "./Tienda";

type Props = { params: Promise<{ negocio: string }> };

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

  const { data: productos } = await supabase
    .from("productos")
    .select("id, categoria_id, nombre, descripcion, precio")
    .eq("negocio_id", negocio.id)
    .order("orden");

  return (
    <Tienda
      nombre={negocio.nombre}
      categorias={categorias ?? []}
      productos={productos ?? []}
    />
  );
}