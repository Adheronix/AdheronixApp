import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { errorMessage } from "../services/api";

export function useResource<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await loader();
      if (mounted.current && id === generation.current) setData(value);
    } catch (e) {
      if (mounted.current && id === generation.current)
        setError(errorMessage(e));
    } finally {
      if (mounted.current && id === generation.current) setLoading(false);
    }
  }, [loader]);
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      void refresh();
      return () => {
        mounted.current = false;
        generation.current++;
      };
    }, [refresh]),
  );
  return { data, loading, error, refresh };
}
