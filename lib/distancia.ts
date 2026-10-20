// Calcula la distancia en kilómetros entre dos puntos (lat, lng)
// usando OpenRouteService. Si falla, retorna null para que el servidor
// responda con error y el cliente lo sepa.

export async function calcularDistancia(
  latOrigen: number,
  lngOrigen: number,
  latDestino: number,
  lngDestino: number
): Promise<number | null> {
  const token = process.env.OPENROUTESERVICE_API_KEY;
  if (!token) {
    console.error("Falta OPENROUTESERVICE_API_KEY");
    return null;
  }

  try {
    const respuesta = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          coordinates: [
            [lngOrigen, latOrigen],
            [lngDestino, latDestino],
          ],
        }),
      }
    );

    if (!respuesta.ok) {
      console.error(
        "OpenRouteService error:",
        respuesta.status,
        await respuesta.text()
      );
      return null;
    }

    const datos = await respuesta.json();
    if (
      !datos.routes ||
      datos.routes.length === 0 ||
      !datos.routes[0].summary
    ) {
      console.error("Respuesta inesperada de OpenRouteService:", datos);
      return null;
    }

    // Retorna la distancia en kilómetros
    return datos.routes[0].summary.distance / 1000;
  } catch (e) {
    console.error("Error calculando distancia:", e);
    return null;
  }
}

// Redondea hacia arriba (3.1 km → 4 km)
export function redondearHaciaArriba(km: number): number {
  return Math.ceil(km);
}

// Calcula el costo del envío: $10 por km
export function costoEnvio(kmRedondeados: number): number {
  return kmRedondeados * 10;
}

// Genera un enlace de Google Maps con la ruta desde origen a destino
export function enlaceGoogleMaps(
  nombreOrigen: string,
  latOrigen: number,
  lngOrigen: number,
  latDestino: number,
  lngDestino: number
): string {
  const encoded = encodeURIComponent(
    `${latOrigen},${lngOrigen}|${latDestino},${lngDestino}`
  );
  return `https://www.google.com/maps/dir/?api=1&origin=${latOrigen},${lngOrigen}&destination=${latDestino},${lngDestino}&waypoints=${encoded}`;
}