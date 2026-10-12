import { createClient } from "@supabase/supabase-js";

// Solo se usa en código del servidor. Nunca importar desde un componente "use client".
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}