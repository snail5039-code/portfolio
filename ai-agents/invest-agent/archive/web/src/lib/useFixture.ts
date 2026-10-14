import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import type { FixtureEnvelope } from "../types/dashboard";

export interface FixtureState<TData> {
  envelope: FixtureEnvelope<TData> | null;
  error: string | null;
  retry: () => void;
}

/**
 * Loads one local fixture envelope with loading, error and retry states.
 *
 * `load` is read through a ref so a page can pass an inline arrow without
 * re-fetching on every render. `key` is what actually identifies the request:
 * change it when the page should fetch something else.
 */
export function useFixture<TData>(
  load: () => Promise<FixtureEnvelope<TData>>,
  key: string
): FixtureState<TData> {
  const [envelope, setEnvelope] = useState<FixtureEnvelope<TData> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setEnvelope(null);
    setError(null);

    loadRef
      .current()
      .then((payload) => {
        if (active) setEnvelope(payload);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof ApiError ? cause.message : "데이터를 불러오지 못했습니다.");
      });

    return () => {
      active = false;
    };
  }, [key, reloadToken]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  return { envelope, error, retry };
}
