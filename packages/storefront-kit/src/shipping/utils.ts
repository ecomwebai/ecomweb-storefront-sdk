import type { LocationArea } from "@ecomweb/sdk";

/**
 * Find an area by code or name, for values stored before codes were used
 * consistently. The old `id` match arm is gone with the field itself: it
 * was the source JSON object's own key, never a stable identifier.
 * @param identifier - Area code, name, or name_with_type
 * @param provinces - Areas to search
 * @returns The area if found, undefined otherwise
 */
export function findProvinceByCodeOrName(
  identifier: string | undefined,
  provinces: LocationArea[]
): LocationArea | undefined {
  if (!identifier) return undefined;
  return provinces.find(
    province =>
      province.code === identifier ||
      province.name === identifier ||
      province.name_with_type === identifier
  );
}

/**
 * Find a ward by code or name, optionally restricted to one province.
 * @param identifier - Area code, name, name_with_type, or a path fragment
 * @param wards - Areas to search
 * @param provinceCode - Optional province code to filter wards
 * @returns The area if found, undefined otherwise
 */
export function findWardByCodeOrName(
  identifier: string | undefined,
  wards: LocationArea[],
  provinceCode?: string
): LocationArea | undefined {
  if (!identifier) return undefined;
  // Filter wards by province first if provinceCode is provided
  const filteredWards = provinceCode
    ? wards.filter(ward => ward.parent_code === provinceCode)
    : wards;

  return filteredWards.find(
    ward =>
      ward.code === identifier ||
      ward.name === identifier ||
      ward.name_with_type === identifier ||
      ward.path?.includes(identifier) ||
      ward.path_with_type?.includes(identifier)
  );
}
