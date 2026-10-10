"use client";

import { useState } from "react";

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
  nombre,
  categorias,
  productos,
}: {
  nombre: string;
  categorias: Categoria[];
  productos: Producto[];
}) {
  const [carrito, setCarrito] = useState<Record<string, number>>({});

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