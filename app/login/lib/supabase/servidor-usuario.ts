import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Lee quién es el cliente que hace la solicitud, usando su cookie de sesión.
// Solo lectura: no inicia sesión, solo dice quién pregunta.
export async function obtenerClienteId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No necesitamos escribir cookies aquí.
        },
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}