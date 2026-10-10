"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar() {
    setError("");
    setCargando(true);
    const supabase = createClient();
    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    });
    setCargando(false);

    if (errorLogin) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    router.push("/panel");
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">Entrar al panel</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          entrar();
        }}
        className="space-y-3"
      >
        <input
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          type="email"
          placeholder="Correo"
          className="w-full rounded-lg border p-3"
        />
        <input
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          type="password"
          placeholder="Contraseña"
          className="w-full rounded-lg border p-3"
        />
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-full bg-black p-3 text-white disabled:opacity-50"
        >
          {cargando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}