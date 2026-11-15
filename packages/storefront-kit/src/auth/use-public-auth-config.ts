"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicAuthConfig } from "@ecomweb/sdk";
import { storeApiPath } from "../store-scope";

export interface UsePublicAuthConfigResult {
  /** `null` while loading and after a failed load — check `error` to tell them apart. */
  config: PublicAuthConfig | null;
  error: boolean;
  reload: () => void;
}

/**
 * The store's public auth config (which sign-in methods are on, and the
 * password policy). Served by the storefront's own route so no API key or
 * backend origin is needed in the browser.
 *
 * Shared by the login/register form and the checkout create-account option so
 * both gate on the same `password_enabled` / `password_policy`.
 */
export function usePublicAuthConfig(
  storeRef: string
): UsePublicAuthConfigResult {
  const [config, setConfig] = useState<PublicAuthConfig | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setConfig(null);

    fetch(storeApiPath(storeRef, "auth/config"))
      .then(res =>
        res.ok ? res.json() : Promise.reject(new Error("config fetch failed"))
      )
      .then((data: PublicAuthConfig) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        // A non-ok response and a thrown fetch are both "could not load" —
        // the shopper has no use for the distinction.
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storeRef, attempt]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);

  return { config, error, reload };
}
