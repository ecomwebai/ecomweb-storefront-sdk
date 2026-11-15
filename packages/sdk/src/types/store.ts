import { z } from "zod";
import {
  timestampSchema,
  deletedAtSchema,
  storeStatusSchema,
  uuidSchema,
  urlSchema,
  optionalTimestampSchema,
  idSchema,
  StoreStatus,
} from "./common";
import { emailBrandingShape } from "./email-branding";
import { embeddedScriptSchema, type EmbeddedScript } from "./embedded-script";

/**
 * Store-related schemas based on Prisma models
 */
// Store main entity
export const storeSchema = z
  .object({
    id: idSchema,
    // The public store endpoints no longer send it.
    user_id: uuidSchema.optional(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    status: storeStatusSchema.default("pending"),
  })
  .extend(timestampSchema.shape)
  .extend(deletedAtSchema.shape);

// Store configuration for domains
export const storeConfigSchema = z
  .object({
    id: idSchema,
    store_id: idSchema,
    subdomain: z.string().optional().nullable(),
    custom_domain: z.string().optional().nullable(),
    /**
     * True once the custom domain's DNS works. The storefront redirects the
     * free subdomain to the custom domain only then.
     */
    verified: z.boolean().optional().nullable(),
  })
  .extend(timestampSchema.shape);

/** Checkout and register links: a store path or an absolute URL each. */
export const legalLinksSchema = z
  .object({
    terms: z.string().optional().nullable(),
    privacy: z.string().optional().nullable(),
  })
  .optional()
  .nullable();

// Store settings (includes blog fields decorated from blog_settings)
export const storeSettingsSchema = z
  .object({
    id: idSchema,
    store_id: idSchema,
    logo_url: urlSchema,
    favicon_url: urlSchema,
    featured_image: urlSchema,
    tiktok_link: urlSchema,
    shopee_link: urlSchema,
    facebook_link: urlSchema,
    instagram_link: urlSchema,
    google_analytics_key: z.string().optional().nullable(),
    tagline: z.string().optional().nullable(),
    blog_title: z.string().optional().nullable(),
    is_blog_enabled: z.boolean().optional().nullable(),
    /**
     * The rest of blog_settings the storefront renders. Absent from older
     * APIs: readers fall back to the platform defaults (built-in blurb, 12
     * posts a page, comments on).
     */
    blog_description: z.string().optional().nullable(),
    posts_per_page: z.int32().optional().nullable(),
    allow_comments: z.boolean().optional().nullable(),
    currency_code: z
      .string()
      .min(3)
      .max(3)
      .default("VND")
      .optional()
      .nullable(),
    review_requests_enabled: z.boolean().optional().nullable(),
    /**
     * Wrap the order sequence to form Order.order_code. A null prefix means
     * the store never configured one and takes the default "#"; an empty
     * string means the merchant deliberately cleared it.
     */
    order_number_prefix: z.string().optional().nullable(),
    order_number_suffix: z.string().optional().nullable(),
    legal_links: legalLinksSchema,
  })
  .extend(emailBrandingShape)
  .extend(optionalTimestampSchema.shape);

// Create store input
export const createStoreSchema = storeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
});

// Update store input
export const updateStoreSchema = createStoreSchema.partial();

// Create store config input
export const createStoreConfigSchema = storeConfigSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Update store config input
export const updateStoreConfigSchema = createStoreConfigSchema.partial().omit({
  store_id: true,
});

// Create store settings input
export const createStoreSettingsSchema = storeSettingsSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

// Update store settings input
export const updateStoreSettingsSchema = createStoreSettingsSchema
  .partial()
  .omit({
    store_id: true,
  });

// Store with relations
export const storeWithRelationsSchema = storeSchema.extend({
  store_config: storeConfigSchema.optional().nullable(),
  store_settings: storeSettingsSchema.optional().nullable(),
  embedded_scripts: z.array(embeddedScriptSchema).optional(),
});

// Export types
export type Store = {
  ref: string;
  /** @deprecated Public store endpoints no longer send it; do not rely on it. */
  user_id?: string;
  name: string;
  description: string | null;
  status: StoreStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  embedded_scripts?: EmbeddedScript[];
  /** Contract "Storefront": true until the merchant opens the store. Absent on older APIs. */
  coming_soon?: boolean;
  /** Contract "Storefront": when the store first opened, null if never. Absent on older APIs. */
  first_opened_at?: string | null;
};
export type StoreConfig = z.infer<typeof storeConfigSchema>;
export type StoreSettings = z.infer<typeof storeSettingsSchema>;
export type CreateStore = z.infer<typeof createStoreSchema>;
export type UpdateStore = z.infer<typeof updateStoreSchema>;
export type CreateStoreConfig = z.infer<typeof createStoreConfigSchema>;
export type UpdateStoreConfig = z.infer<typeof updateStoreConfigSchema>;
export type CreateStoreSettings = z.infer<typeof createStoreSettingsSchema>;
export type UpdateStoreSettings = z.infer<typeof updateStoreSettingsSchema>;
export type StoreWithRelations = z.infer<typeof storeWithRelationsSchema>;
