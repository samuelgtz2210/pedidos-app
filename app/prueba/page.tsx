import { createClient } from "@/lib/supabase/server";

export default async function PaginaPrueba() {
  const supabase = await createClient();

  const { data: productos, error } = await supabase
    .from("productos")
    .select("id, nombre, descripcion, precio");

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Productos</h1>
      <ul>
        {productos?.map((p) => (
          <li key={p.id}>
            {p.nombre} - ${p.precio}
          </li>
        ))}
      </ul>
    </main>
  );
}