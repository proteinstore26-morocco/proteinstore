import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_IMAGE_BASE64,
  MAX_IMAGE_BYTES,
  MIME_BY_EXTENSION,
  detectImageExtension,
} from "./image-upload";

type AdminContext = { supabase: SupabaseClient<Database>; userId: string; claims?: unknown };
type UploadInput = { contentType: "image/jpeg" | "image/png" | "image/webp"; data: string };

const uploadSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(16).max(MAX_IMAGE_BASE64),
});

async function storeImage(
  context: AdminContext,
  input: UploadInput,
  folder: "products" | "partners",
  rateKey: string,
) {
  const { requireStoreAdmin } = await import("./admin-guard.server");
  const admin = await requireStoreAdmin(
    context.supabase,
    context.userId,
    "admin",
    context.claims as AdminContext["claims"],
  );

  const { takeToken } = await import("./rate-limit");
  const limited = takeToken(`${rateKey}:${admin.userId}`, 40, 10 * 60_000);
  if (!limited.ok) throw new Error("Trop d'uploads. Réessayez dans quelques minutes.");

  const { randomUUID } = await import("node:crypto");
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const root = process.env["UPLOAD_DIR"] ?? join(process.cwd(), "data", "uploads");

  const buffer = Buffer.from(input.data, "base64");
  if (buffer.length === 0) throw new Error("Fichier vide.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image trop lourde (max 4 Mo).");
  const extension = detectImageExtension(buffer);
  if (!extension) throw new Error("Format non reconnu. Utilisez JPEG, PNG ou WebP.");
  if (MIME_BY_EXTENSION[extension] !== input.contentType) {
    throw new Error("Le contenu du fichier ne correspond pas à son type.");
  }

  const directory = join(root, folder);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(join(directory, filename), buffer, { mode: 0o644 });
  return { url: `/uploads/${folder}/${filename}` };
}

export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ context, data }) => storeImage(context, data, "products", "upload-product"));

export const uploadPartnerLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ context, data }) => storeImage(context, data, "partners", "upload-partner"));
