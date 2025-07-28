import { z } from "zod";

/**
 * Site configuration schema for different e-commerce platforms
 */
export const SiteConfigSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  adapter_type: z.enum(["shopify", "mcas", "generic"]),

  rate_limit: z.object({
    requests_per_minute: z.number().min(1).max(300),
    delay_between_requests: z.number().min(500).max(30000), // ms
    concurrent_requests: z.number().min(1).max(10),
  }),

  categories: z.array(z.string()),

  selectors: z.object({
    product_container: z.string(),
    product_name: z.string(),
    price: z.string(),
    sale_price: z.string().optional(),
    stock_status: z.string(),
    brand: z.string().optional(),
    images: z.string(),
    description: z.string().optional(),
    specifications: z.string().optional(),
    variants: z.string().optional(),
  }),

  navigation: z.object({
    product_list_pattern: z.string(),
    product_page_pattern: z.string(),
    pagination_selector: z.string().optional(),
    category_urls: z.record(z.string(), z.string()).optional(),
    sitemap_url: z.string().optional(),
  }),

  anti_detection: z
    .object({
      use_stealth: z.boolean().default(true),
      rotate_user_agents: z.boolean().default(true),
      simulate_human_behavior: z.boolean().default(true),
      block_images: z.boolean().default(false),
      block_css: z.boolean().default(false),
    })
    .optional(),

  custom_headers: z.record(z.string(), z.string()).optional(),
  cookies: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        domain: z.string().optional(),
        path: z.string().optional(),
      })
    )
    .optional(),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

/**
 * Global application settings schema
 */
export const AppSettingsSchema = z.object({
  global_settings: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().min(5000).max(120000).default(30000),
    max_retries: z.number().min(0).max(10).default(3),
    max_concurrent_requests: z.number().min(1).max(10).default(3),
    delay_between_requests: z.number().min(500).max(10000).default(1000),
    max_requests_per_minute: z.number().min(10).max(300).default(60),
    output_format: z.enum(["json", "csv", "sqlite"]).default("json"),
    output_directory: z.string().default("./data"),
    image_download: z.boolean().default(true),
    image_directory: z.string().default("./data/images"),
    log_level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),

  browser_settings: z.object({
    viewport: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }),
    user_agent: z.string().optional(),
    locale: z.string().default("en-AU"),
    timezone: z.string().default("Australia/Sydney"),
  }),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;
