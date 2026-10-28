import { z } from "zod";
import {
  MAX_PRODUCT_IMAGES,
  isAllowedCategoryImageUrl,
  isAllowedPartnerLogoUrl,
  isAllowedProductImageUrl,
} from "./image-upload";

export const canManageStore = (roles: string[]) =>
  roles.includes("admin") || roles.includes("super_admin");
export const canManageStaff = (roles: string[]) => roles.includes("super_admin");
export const canRevokeStaff = (actor: string, target: string, roles: string[]) =>
  actor !== target && !roles.includes("super_admin");
export const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);
export const statusLabels: Record<z.infer<typeof orderStatusSchema>, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};
/** Slug URL dérivé du titre (accents retirés). */
export const slugify = (title: string): string =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "produit";

export const productEditSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().trim().max(200).optional(),
    title: z.string().trim().min(2).max(200),
    brand: z.string().trim().max(100),
    description: z.string().trim().max(10000),
    category_id: z.string().uuid().nullable(),
    price: z.number().int().min(0),
    sale_price: z.number().int().min(0).nullable(),
    stock_quantity: z.number().int().min(0),
    low_stock_threshold: z.number().int().min(0),
    status: z.enum(["published", "draft"]),
    is_featured: z.boolean(),
    flavors: z.array(z.string().trim().min(1).max(60)).max(50),
    image_urls: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .refine(isAllowedProductImageUrl, "URL d'image invalide."),
      )
      .max(MAX_PRODUCT_IMAGES, `Maximum ${MAX_PRODUCT_IMAGES} photos par produit.`)
      .refine((urls) => new Set(urls).size === urls.length, "Photos en double."),
  })
  .refine((p) => p.sale_price === null || p.sale_price <= p.price, {
    message: "Le prix promotionnel doit être inférieur ou égal au prix normal.",
    path: ["sale_price"],
  });
export const partnerEditSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  location: z.string().trim().max(150),
  address: z.string().trim().max(500),
  description: z.string().trim().max(3000),
  discount_code: z.string().trim().max(50),
  discount_percent: z.number().int().min(0).max(90).optional(),
  website_url: z
    .string()
    .url()
    .regex(/^https:\/\//)
    .or(z.literal("")),
  instagram_url: z
    .string()
    .url()
    .regex(/^https:\/\//)
    .or(z.literal("")),
  is_active: z.boolean(),
  display_order: z.number().int().min(0),
  logo_url: z
    .string()
    .trim()
    .max(2000)
    .refine(isAllowedPartnerLogoUrl, "URL de logo invalide.")
    .nullable(),
});

export const categoryEditSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000),
  image_url: z
    .string()
    .trim()
    .max(2000)
    .refine(isAllowedCategoryImageUrl, "URL d'image invalide.")
    .nullable(),
  display_order: z.number().int().min(0),
});
