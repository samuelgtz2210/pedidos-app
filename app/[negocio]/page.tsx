import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <>
      <h1 className="mb-6 text-3xl font-bold">{negocio.nombre}</h1>

      {categorias?.map((cat) => (
        <section key={cat.id} className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">{cat.nombre}</h2>
          <ul className="divide-y rounded-lg border">
            {productos
              ?.filter((p) => p.categoria_id === cat.id)
              .map((p) => (
                <li key={p.id} className="flex justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{p.nombre}</p>
                    {p.descripcion && (
                      <p className="text-sm text-gray-500">{p.descripcion}</p>
                    )}
                  </div>
                  <p className="font-medium">${p.precio}</p>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}