"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ cada }: { cada: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), cada);
    return () => clearInterval(id);
  }, [router, cada]);

  return null;
}