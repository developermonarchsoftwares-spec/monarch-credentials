import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export const useFetch = <T,>(path: string | null) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    api<T>(path).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message ?? "Failed to load")).finally(() => setLoading(false));
  }, [path]);
  useEffect(load, [load]);
  return { data, error, loading, reload: load };
};

export const useDebounced = <T,>(value: T, ms = 300): T => {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
};
