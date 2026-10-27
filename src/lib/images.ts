import whey from "@/assets/cat-whey.jpg";
import gainers from "@/assets/cat-gainers.jpg";
import creatine from "@/assets/cat-creatine.jpg";
import pre from "@/assets/cat-pre-workout.jpg";
import amino from "@/assets/cat-acides-amines.jpg";
import burn from "@/assets/cat-bruleurs.jpg";
import sante from "@/assets/cat-sante.jpg";
import { proxiedImage } from "@/lib/image-proxy";

export const categoryImages: Record<string, string> = {
  whey, gainers, creatine, "pre-workout": pre, "acides-amines": amino, bruleurs: burn, sante, barres: whey,
};

export function productImage(p: { image_urls?: string[] | null; category?: { slug: string } | null }) {
  return p.image_urls?.[0] || categoryImages[p.category?.slug ?? ""] || whey;
}
