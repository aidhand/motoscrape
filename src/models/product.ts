import { z } from "zod";
import { ProductVariantSchema } from "./variant.js";

/**
 * Core product schema for Australian motorcycle gear
 */
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  sku: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),

  price: z.object({
    regular: z.number(),
    sale: z.number().optional(),
    currency: z.literal("AUD"),
    discount_percentage: z.number().optional(),
  }),

  availability: z.object({
    in_stock: z.boolean(),
    quantity: z.number().optional(),
    stock_status: z.enum(["in_stock", "out_of_stock", "backorder", "preorder"]),
  }),

  variants: z.array(ProductVariantSchema).optional(),
  images: z.array(z.string()),

  description: z.object({
    short: z.string().optional(),
    full: z.string().optional(),
    features: z.array(z.string()).optional(),
    specifications: z.record(z.string(), z.string()).optional(),
  }),

  // Australian-specific fields
  certifications: z.array(z.string()).optional(), // CE, DOT, ECE standards
  compliance: z
    .object({
      adr: z.boolean().optional(), // Australian Design Rules
      australian_standards: z.array(z.string()).optional(),
    })
    .optional(),

  compatibility: z
    .object({
      vehicle_types: z.array(z.string()).optional(),
      makes: z.array(z.string()).optional(),
      models: z.array(z.string()).optional(),
      years: z.array(z.number()).optional(),
    })
    .optional(),

  shipping: z
    .object({
      weight: z.number().optional(), // in kg
      dimensions: z
        .object({
          length: z.number(),
          width: z.number(),
          height: z.number(),
          unit: z.literal("cm"),
        })
        .optional(),
      restrictions: z.array(z.string()).optional(),
      free_shipping_eligible: z.boolean().optional(),
    })
    .optional(),

  reviews: z
    .object({
      average_rating: z.number().optional(),
      review_count: z.number().optional(),
      rating_distribution: z.record(z.string(), z.number()).optional(),
    })
    .optional(),

  metadata: z.object({
    scraped_at: z.union([z.date(), z.string().datetime()]).transform((val) => 
      typeof val === 'string' ? new Date(val) : val
    ),
    source_url: z.string(),
    site: z.string(),
    last_updated: z.union([z.date(), z.string().datetime()]).transform((val) => 
      typeof val === 'string' ? new Date(val) : val
    ).optional(),
    scrape_quality_score: z.number().optional(), // 0-1 based on data completeness
  }),
});

export type Product = z.infer<typeof ProductSchema>;

/**
 * Simplified product schema for search/listing pages
 */
export const ProductSummarySchema = ProductSchema.pick({
  id: true,
  name: true,
  brand: true,
  category: true,
  price: true,
  availability: true,
  images: true,
  metadata: true,
});

export type ProductSummary = z.infer<typeof ProductSummarySchema>;
