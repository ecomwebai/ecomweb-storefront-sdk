/**
 * Theme preview hosts: every store theme has its own p-<slug>.<suffix>,
 * where the shared storefront renders that theme (a build's runs on its own
 * pods instead). The middleware names the slug to the page in this request
 * header; it always drops one sent by the client.
 */
export const THEME_PREVIEW_HOST_HEADER = "x-ecomweb-preview-slug";

/** The robots.txt of a preview host: nothing there is for search engines. */
export const PREVIEW_HOST_ROBOTS = "User-agent: *\nDisallow: /\n";
