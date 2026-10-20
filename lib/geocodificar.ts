// Valida que la dirección sea real usando Nominatim (gratuito, sin tarjeta)
// Retorna [lat, lng] si es válida, o null si no la encuentra

export async function geocodificar(
  direccion: string,
  ciudad: string = "Zapopan"
): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = `${direccion}, ${ciudad}, Jalisco, México`;
    const respuesta = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { "User-Agent": "SIGA-Pedidos" } }
    );

    if (!respuesta.ok) {
      return null;
    }

    const resultados = await respuesta.json();
    if (!Array.isArray(resultados) || resultados.length === 0) {
      return null;
    }

    const primer = resultados[0] as { lat?: string; lon?: string };
    return {
      lat: Number(primer.lat),
      lng: Number(primer.lon),
    };
  } catch (e) {
    console.error("Error geocodificando:", e);
    return null;
  }
}