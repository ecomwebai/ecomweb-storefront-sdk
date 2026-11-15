"use client";

import { useEffect, useMemo, useState } from "react";
import type { LocationArea, LocationAreasResponse } from "@ecomweb/sdk";
import { LEVEL_PROVINCE } from "@ecomweb/sdk";
import { sdk } from "../sdk";

/**
 * Location data is fetched in two steps rather than all at once: the 34
 * provinces up front, then one province's wards when something actually
 * needs them. Fetching everything cost 751 KB and every ward in the
 * country on a page that shows at most one province's worth.
 *
 * Caches hold the in-flight promise, not just the result, so concurrent
 * callers (a checkout page mounts several) share one request. A failure
 * is evicted so it is never cached.
 */
type Fetcher = (
  storeRef: string,
  query: { level?: number; parent_code?: string }
) => Promise<LocationAreasResponse>;

const defaultFetcher: Fetcher = (storeRef, query) =>
  sdk.shipping.listLocationAreas(storeRef, query);

const provinceCache = new Map<string, Promise<LocationArea[]>>();
const wardCache = new Map<string, Promise<LocationArea[]>>();

/** Test seam. Never called by application code. */
export function __resetLocationCaches() {
  provinceCache.clear();
  wardCache.clear();
}

export function loadProvinces(
  storeRef: string,
  fetcher: Fetcher = defaultFetcher
): Promise<LocationArea[]> {
  let pending = provinceCache.get(storeRef);
  if (!pending) {
    pending = fetcher(storeRef, { level: LEVEL_PROVINCE })
      .then(r => r.areas)
      .catch(error => {
        provinceCache.delete(storeRef);
        throw error;
      });
    provinceCache.set(storeRef, pending);
  }
  return pending;
}

export function loadWards(
  storeRef: string,
  provinceCode: string | undefined,
  fetcher: Fetcher = defaultFetcher
): Promise<LocationArea[]> {
  if (!provinceCode) return Promise.resolve([]);

  const key = `${storeRef}:${provinceCode}`;
  let pending = wardCache.get(key);
  if (!pending) {
    pending = fetcher(storeRef, { parent_code: provinceCode })
      .then(r => r.areas)
      .catch(error => {
        wardCache.delete(key);
        throw error;
      });
    wardCache.set(key, pending);
  }
  return pending;
}

export function useProvinces(storeRef: string) {
  const [provinces, setProvinces] = useState<LocationArea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadProvinces(storeRef)
      .then(areas => {
        if (!cancelled) setProvinces(areas);
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error("Failed to load provinces:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeRef]);

  return { provinces, loading };
}

export function useWards(storeRef: string, provinceCode: string | undefined) {
  const [wards, setWards] = useState<LocationArea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Drop the previous province's wards up front. Keeping them until the
    // new list arrives leaves wards from the wrong province selectable,
    // and on a failed request it leaves them there for good.
    setWards([]);

    if (!provinceCode) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadWards(storeRef, provinceCode)
      .then(areas => {
        if (!cancelled) setWards(areas);
      })
      .catch(error => {
        if (!cancelled) setWards([]);
        // eslint-disable-next-line no-console
        console.error("Failed to load wards:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeRef, provinceCode]);

  return { wards, loading };
}

/**
 * The string a combobox filters on. cmdk matches against a CommandItem's
 * `value`, so putting the code there alone meant a shopper had to type
 * "12" to find Hồ Chí Minh. This puts the names in, plus the slug with
 * its hyphens spaced out so typing without accents ("ho chi minh") still
 * matches. The code stays searchable for anyone who knows it.
 */
export function searchTextFor(area: LocationArea): string {
  return [
    area.name_with_type,
    area.name,
    (area.slug || "").replace(/-/g, " "),
    area.code,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Look up one area by code within a list, for display labels. */
export function byCode(areas: LocationArea[], code: string | undefined) {
  if (!code) return undefined;
  return areas.find(area => area.code === code);
}

export function useAreaLabel(areas: LocationArea[], code: string | undefined) {
  return useMemo(() => byCode(areas, code), [areas, code]);
}
