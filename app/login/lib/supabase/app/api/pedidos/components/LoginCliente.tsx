"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginCliente({ onLogin }: { onLogin: () => void }) {
  const [supabase] = useState(() => createClient());
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function enviarCodigo() {
    setError("");
    if (!email.trim().includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setEnviando(false);
    if (err) {
      setError("No pudimos enviar el código. Intenta de nuevo.");
      return;
    }
    setPaso("codigo");
  }

  async function confirmarCodigo() {
    setError("");
    if (codigo.trim().length < 6) {
      setError("Escribe el código de 6 dígitos.");
      return;
    }
    setEnviando(true);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codigo.trim(),
      type: "email",
    });
    setEnviando(false);
    if (err) {
      setError("El código no es correcto o ya expiró.");
      return;
    }
    onLogin();
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {paso === "email" ? (
        <>
          <p className="text-sm font-medium">Inicia sesión con tu correo</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            type="email"
            className="w-full rounded-lg border p-3"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={enviarCodigo}
            disabled={enviando}
            className="w-full rounded-full bg-black p-3 text-white disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Enviar código"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">
            Escribe el código que enviamos a {email}
          </p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            className="w-full rounded-lg border p-3 text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={confirmarCodigo}
            disabled={enviando}
            className="w-full rounded-full bg-black p-3 text-white disabled:opacity-50"
          >
            {enviando ? "Verificando..." : "Confirmar"}
          </button>
          <button
            onClick={() => setPaso("email")}
            className="w-full rounded-full border p-3 text-sm"
          >
            Cambiar correo
          </button>
        </>
      )}
    </div>
  );
}