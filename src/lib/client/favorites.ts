"use client";
import { useEffect, useState } from "react";

/**
 * Favoritos do visitante: só ids no localStorage do navegador.
 * Sem conta, sem servidor — e sem quebrar se o storage estiver bloqueado.
 */
const KEY = "vitrine:favoritos";
const EVT = "vitrine:favoritos";

export function readFavorites(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, 100)));
  } catch {
    /* storage indisponível: segue só na memória da página */
  }
  window.dispatchEvent(new Event(EVT));
}

export function toggleFavorite(id: number) {
  const ids = readFavorites();
  write(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids]);
}

/** Hook reativo (sincroniza entre abas e componentes) */
export function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => {
    const sync = () => setIds(readFavorites());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}
