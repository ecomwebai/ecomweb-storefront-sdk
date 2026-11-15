import type {
  ResolvedMetaobjectRef,
  ResolvedMetaobjectStub,
  StorefrontMetafields,
  WithMetafields,
} from "@ecomweb/sdk";

function read<V>(
  fields: StorefrontMetafields | undefined,
  name: string
): V | undefined {
  // Own properties only: "__proto__" or "toString" must not reach the prototype.
  if (!fields || !Object.prototype.hasOwnProperty.call(fields, name)) {
    return undefined;
  }
  const value = fields[name]?.value;
  // A hidden reference resolves to null (spec 6.5); "no value" is undefined.
  return value === null || value === undefined ? undefined : (value as V);
}

/**
 * A metafield's resolved value by identifier, e.g.
 * `metafield<RichTextRoot>(product, "custom.care_guide")`.
 *
 * Works on any public resource that carries `metafields` (product, variant,
 * collection, content page, blog post, store, customer order). Returns
 * undefined when the definition has no storefront access, the owner has no
 * value, or the value is a reference the storefront may not see. The generic
 * is a cast, not a check: pick it from the definition's type.
 *
 * The first argument may also be a bare metafield map, as returned by
 * `sdk.customers.getMetafields()`. A resource is told from a map by its own
 * `metafields` key (identifiers always contain a dot, so none can collide).
 */
export function metafield<V = unknown>(
  resource: WithMetafields | StorefrontMetafields | null | undefined,
  identifier: string
): V | undefined {
  if (resource === null || typeof resource !== "object") return undefined;
  const isResource = Object.prototype.hasOwnProperty.call(
    resource,
    "metafields"
  );
  return read<V>(
    isResource
      ? (resource as WithMetafields).metafields
      : (resource as StorefrontMetafields),
    identifier
  );
}

/**
 * A metaobject entry's field value by field key, e.g.
 * `metaobjectField<string>(entry, "name")`. Undefined for a missing or hidden
 * value, and for a reference deeper than the resolution depth (a
 * `{ type, handle }` stub has no fields).
 */
export function metaobjectField<V = unknown>(
  entry: ResolvedMetaobjectRef | ResolvedMetaobjectStub | null | undefined,
  key: string
): V | undefined {
  const fields =
    entry !== null && typeof entry === "object" && "fields" in entry
      ? (entry as ResolvedMetaobjectRef).fields
      : undefined;
  return read<V>(fields, key);
}
