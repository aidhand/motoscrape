import { SiteConfig, SiteConfigSchema } from "../models/site-config.js";

/**
 * MotoHeaven configuration
 */
export const motoheavenConfig: SiteConfig = SiteConfigSchema.parse({
  name: "motoheaven",
  base_url: "https://www.motoheaven.com.au",
  adapter_type: "shopify",

  rate_limit: {
    requests_per_minute: 30,
    delay_between_requests: 5000,
    concurrent_requests: 6,
  },

  categories: ["helmets", "jackets", "gloves", "boots", "pants", "accessories"],

  selectors: {
    // Collection page selectors
    product_container: ".product-item",
    product_name: ".product-item__product-title",
    price: ".product-item__price-main",
    sale_price: ".product-item__price-main", // Same element contains both regular and sale price
    stock_status: ".product-item__stock", // May not exist on listing pages
    brand: ".product-item__product-vendor",
    images: ".product-item__image img",
    
    // Product page selectors (updated based on actual MotoHeaven structure)
    product_title: "h1",
    product_brand: 'a[href*="/collections/"]', // Brand link like /collections/agv
    product_sku: 'text', // Will extract from text content
    product_images: 'img[alt*="AGV"], .product-media img, img[src*="agv"], img[src*="helmet"]',
    product_description: '.product-description, [data-testid="description"], .description',
    product_specifications: '.product-specs, .specifications, .spec-table',
    product_variants: 'button', // Size buttons M, L, XL
    product_price: '.product-price, [class*="price"]',
    
    // Legacy selectors for compatibility
    description: ".product-description",
    specifications: ".product-specs",
    variants: ".product-variants",
  },

  navigation: {
    product_list_pattern: "/collections/{category}",
    product_page_pattern: "/products/{slug}",
    pagination_selector: ".pagination__next",
    category_urls: {
      helmets: "/collections/helmets",
      jackets: "/collections/jackets",
      gloves: "/collections/gloves",
      boots: "/collections/boots",
      pants: "/collections/pants",
      accessories: "/collections/accessories",
    },
  },
});

/**
 * MCAS configuration
 */
export const mcasConfig: SiteConfig = SiteConfigSchema.parse({
  name: "mcas",
  base_url: "https://www.mcas.com.au",
  adapter_type: "mcas",

  rate_limit: {
    requests_per_minute: 10,
    delay_between_requests: 5000,
    concurrent_requests: 1,
  },

  categories: [
    "motorcycle-helmets",
    "motorcycle-clothing",
    "motorcycle-gloves",
    "motorcycle-boots",
  ],

  selectors: {
    product_container: ".product-grid-item",
    product_name: ".product-name",
    price: ".current-price",
    sale_price: ".sale-price",
    stock_status: ".stock-indicator",
    brand: ".brand-name",
    images: ".product-image img",
    description: ".product-description",
    specifications: ".product-specifications",
  },

  navigation: {
    product_list_pattern: "/category/{category}",
    product_page_pattern: "/product/{id}",
    pagination_selector: ".pagination-next",
  },
});

/**
 * All available site configurations
 */
export const siteConfigs = {
  motoheaven: motoheavenConfig,
  mcas: mcasConfig,
};

/**
 * Get site configuration by name
 */
export function getSiteConfig(name: string): SiteConfig | undefined {
  return siteConfigs[name as keyof typeof siteConfigs];
}

/**
 * Get all site configurations as array
 */
export function getAllSiteConfigs(): SiteConfig[] {
  return Object.values(siteConfigs);
}