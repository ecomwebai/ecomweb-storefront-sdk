// ---------------------------------------------
// Image URL helpers
// ---------------------------------------------
//
// The storefront does not talk to a storage SDK. Object URLs are plain strings,
// so there was nothing here a client library was needed for: getPublicUrl()
// only ever concatenated base + bucket + path.
//
// Everything is built against NEXT_PUBLIC_ASSET_BASE_URL, which points at our
// own API (e.g. https://apibase.ecomweb.app). The path shapes below are the
// ones the API serves and the ones already stored in the database.
//
// Crucially, a stored URL's ORIGIN is ignored and rebuilt. Rows written before
// the storage migration carry whatever host was configured at the time —
// locally that is Kong on :8000, or an older Supabase on :54321 — and those
// hosts no longer serve anything. Rebuilding is what lets old and new rows
// resolve identically with no database backfill.
//
// The browser-side upload/delete helpers that used to live here wrote directly
// to supabase/storage-api, which has been retired. They had no callers and were
// removed; uploads go through the API's asset endpoints.

const OBJECT_PREFIX = "/storage/v1/object/public/";
import { publicConfig } from "./config";
const RENDER_PREFIX = "/storage/v1/render/image/public/";

const DEFAULT_BUCKET = "public-cdn";

type ResizeMode = "cover" | "contain" | "inside" | "outside";
type ImageFormat = "origin" | "avif" | "webp" | "png" | "jpeg";

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  resize?: ResizeMode; // default: cover
  quality?: number; // 1..100, default: 80
  format?: ImageFormat; // default: origin
}

function assetBaseUrl(): string {
  return publicConfig().assetBaseUrl;
}

function transformationsEnabled(): boolean {
  const flag = publicConfig().imageTransformationsFlag;
  if (typeof flag === "string" && flag !== "") {
    return ["1", "true", "yes", "on"].includes(flag.toLowerCase());
  }
  // Local stacks may not run the image renderer, so serve originals.
  return !/localhost|127\.0\.0\.1/.test(assetBaseUrl());
}

function buildTransformQuery(opts?: ImageTransformOptions): string {
  if (!opts) return "";
  const params = new URLSearchParams();
  if (opts.width && Number.isFinite(opts.width))
    params.set("width", String(opts.width));
  if (opts.height && Number.isFinite(opts.height))
    params.set("height", String(opts.height));
  if (opts.resize) params.set("resize", opts.resize);
  if (opts.quality && Number.isFinite(opts.quality))
    params.set("quality", String(opts.quality));
  if (opts.format) params.set("format", opts.format);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Pull bucket + object path out of a storage URL, whatever host it names.
 * Accepts both the object and render path shapes.
 */
function parseStorageUrl(
  url: string
): { bucket: string; path: string } | null {
  try {
    const { pathname } = new URL(url);
    const prefix = [OBJECT_PREFIX, RENDER_PREFIX].find((p) =>
      pathname.includes(p)
    );
    if (!prefix) return null;

    const parts = pathname.split(prefix)[1].split("/");
    const bucket = parts.shift();
    if (!bucket || parts.length === 0) return null;

    return { bucket, path: parts.join("/") };
  } catch {
    return null;
  }
}

function buildAssetUrl(
  bucket: string,
  path: string,
  opts?: ImageTransformOptions
): string | null {
  const base = assetBaseUrl();
  if (!base) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[storage] NEXT_PUBLIC_ASSET_BASE_URL is not set — image URLs cannot be resolved."
      );
    }
    return null;
  }

  const normalizedPath = path.replace(/^\//, "");

  if (transformationsEnabled()) {
    const query = buildTransformQuery({ resize: "cover", quality: 80, ...opts });
    return `${base}${RENDER_PREFIX}${bucket}/${normalizedPath}${query}`;
  }

  return `${base}${OBJECT_PREFIX}${bucket}/${normalizedPath}`;
}

/**
 * Resolve any image reference (full URL or bare storage object path) into a
 * URL, applying transformation params when enabled.
 *
 * - A full http(s) URL that is not a storage URL is returned as-is.
 * - A storage URL is rebuilt against the configured base, ignoring its host.
 * - A bare object path is resolved within `defaultBucket`.
 */
export function resolveTransformedImageUrl(
  imagePathOrUrl: string | null | undefined,
  opts?: ImageTransformOptions,
  defaultBucket: "public-cdn" = DEFAULT_BUCKET
): string | null {
  if (!imagePathOrUrl) return null;

  if (/^https?:\/\//i.test(imagePathOrUrl)) {
    const parsed = parseStorageUrl(imagePathOrUrl);
    if (!parsed) return imagePathOrUrl;
    return buildAssetUrl(parsed.bucket, parsed.path, opts) ?? imagePathOrUrl;
  }

  // Starts with / -> a local app asset, not storage. Leave untouched.
  if (imagePathOrUrl.startsWith("/")) {
    return imagePathOrUrl;
  }

  return buildAssetUrl(defaultBucket, imagePathOrUrl, opts);
}

/** Object URL without any transformation. */
function resolveObjectUrl(
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;

  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    const parsed = parseStorageUrl(imagePath);
    if (!parsed) return imagePath;
    const base = assetBaseUrl();
    return base
      ? `${base}${OBJECT_PREFIX}${parsed.bucket}/${parsed.path}`
      : imagePath;
  }

  if (imagePath.startsWith("/")) return imagePath;

  const base = assetBaseUrl();
  return base ? `${base}${OBJECT_PREFIX}${DEFAULT_BUCKET}/${imagePath}` : null;
}

export function resolvePublicUrl(
  imagePath: string | null | undefined
): string | null {
  return resolveObjectUrl(imagePath);
}

export function resolveStoreLogoUrl(
  logoPath: string | null | undefined
): string | null {
  return resolveObjectUrl(logoPath);
}

export function resolveBlogUrl(
  imagePath: string | null | undefined
): string | null {
  return resolveObjectUrl(imagePath);
}

// Convenience wrappers with sensible defaults per bucket
export function resolveTransformedProductImageUrl(
  imagePathOrUrl: string | null | undefined,
  opts?: ImageTransformOptions
): string | null {
  return resolveTransformedImageUrl(imagePathOrUrl, opts, DEFAULT_BUCKET);
}

export function resolveTransformedStoreLogoUrl(
  imagePathOrUrl: string | null | undefined,
  opts?: ImageTransformOptions
): string | null {
  return resolveTransformedImageUrl(imagePathOrUrl, opts, DEFAULT_BUCKET);
}

export function resolveTransformedBlogUrl(
  imagePathOrUrl: string | null | undefined,
  opts?: ImageTransformOptions
): string | null {
  return resolveTransformedImageUrl(imagePathOrUrl, opts, DEFAULT_BUCKET);
}

/**
 * Null-safe wrapper for use directly in `src={...}`.
 *
 * Rebuilds against the current NEXT_PUBLIC_ASSET_BASE_URL regardless of the
 * stored host, and passes non-storage URLs through untouched.
 */
export function resolveAssetSrc(
  url: string | null | undefined,
  opts?: ImageTransformOptions
): string {
  return resolveTransformedImageUrl(url, opts) ?? "";
}
