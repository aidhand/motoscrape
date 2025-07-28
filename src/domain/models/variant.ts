import { z } from "zod";

/**
 * Product variant schema for different sizes, colors, styles, etc.
 */
export const ProductVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional(),
  type: z.enum(["size", "color", "style", "material"]),
  value: z.string(),
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
  images: z.array(z.string()).optional(),
});

export type ProductVariant = z.infer<typeof ProductVariantSchema>;
