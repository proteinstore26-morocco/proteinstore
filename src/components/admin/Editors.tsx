import { useRef, useState, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImagePlus, Link2, Loader2, Save, Trash2 } from "lucide-react";
import { statusLabels, orderStatusSchema } from "@/lib/admin-rules";
import { mad } from "@/lib/pricing";
import {
  MAX_PRODUCT_IMAGES,
  isAllowedCategoryImageUrl,
  isAllowedPartnerLogoUrl,
  isAllowedProductImageUrl,
} from "@/lib/image-upload";
import { uploadCategoryImage, uploadPartnerLogo, uploadProductImage } from "@/lib/uploads.functions";
import { useServerFn } from "@tanstack/react-start";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
export function Choice({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={value}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
export function EditorDialog({
  title,
  subtitle,
  close,
  children,
}: {
  title: string;
  subtitle: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function SaveButton({ busy }: { busy: boolean }) {
  return (
    <Button type="submit" disabled={busy}>
      <Save />
      {busy ? "Enregistrement…" : "Enregistrer"}
    </Button>
  );
}
async function toUploadPayload(
  file: File,
): Promise<{ contentType: "image/jpeg" | "image/png" | "image/webp"; data: string }> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type))
    throw new Error("Format non supporté. Utilisez JPEG, PNG ou WebP.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Photo trop lourde (max 15 Mo avant compression).");

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Compression impossible dans ce navigateur.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    return { contentType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
  } catch (error) {
    if (file.size > 4 * 1024 * 1024)
      throw error instanceof Error ? error : new Error("Photo trop lourde (max 4 Mo).");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });
    return {
      contentType: file.type as "image/jpeg" | "image/png" | "image/webp",
      data: dataUrl.split(",")[1] ?? "",
    };
  }
}

export function ProductFields({
  product,
  categories,
}: {
  product: Tables<"products">;
  categories: Tables<"categories">[];
}) {
  const upload = useServerFn(uploadProductImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>(() =>
    (product.image_urls ?? []).slice(0, MAX_PRODUCT_IMAGES),
  );
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addUrl() {
    const candidate = url.trim();
    if (!isAllowedProductImageUrl(candidate)) {
      setError("URL invalide : utilisez https://… ou une photo uploadée.");
      return;
    }
    if (images.length >= MAX_PRODUCT_IMAGES) {
      setError(`Maximum ${MAX_PRODUCT_IMAGES} photos.`);
      return;
    }
    if (images.includes(candidate)) {
      setError("Cette photo est déjà présente.");
      return;
    }
    setImages((current) => [...current, candidate].slice(0, MAX_PRODUCT_IMAGES));
    setUrl("");
    setError("");
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_PRODUCT_IMAGES - images.length;
    if (room <= 0) {
      setError(`Maximum ${MAX_PRODUCT_IMAGES} photos.`);
      return;
    }
    setBusy(true);
    setError("");
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const payload = await toUploadPayload(file);
        const result = await upload({ data: payload });
        setImages((current) =>
          current.includes(result.url) || current.length >= MAX_PRODUCT_IMAGES
            ? current
            : [...current, result.url],
        );
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload impossible.");
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom du produit">
        <Input name="title" defaultValue={product.title} required maxLength={200} />
      </Field>
      <Field label="Marque">
        <Input name="brand" defaultValue={product.brand ?? ""} />
      </Field>
      <Choice
        label="Catégorie"
        name="category_id"
        value={product.category_id ?? "none"}
        options={[
          { value: "none", label: "Sans catégorie" },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <Choice
        label="Publication"
        name="status"
        value={product.status === "published" ? "published" : "draft"}
        options={[
          { value: "published", label: "Publié" },
          { value: "draft", label: "Brouillon" },
        ]}
      />
      <Field label="Prix (MAD)">
        <Input name="price" type="number" min={0} step={1} defaultValue={product.price} required />
      </Field>
      <Field label="Prix promotionnel (MAD)">
        <Input
          name="sale_price"
          type="number"
          min={0}
          step={1}
          defaultValue={product.sale_price ?? ""}
        />
      </Field>
      <Field label="Stock">
        <Input
          name="stock_quantity"
          type="number"
          min={0}
          step={1}
          defaultValue={product.stock_quantity}
          required
        />
      </Field>
      <Field label="Seuil d’alerte stock">
        <Input
          name="low_stock_threshold"
          type="number"
          min={0}
          step={1}
          defaultValue={product.low_stock_threshold}
          required
        />
      </Field>

      <div className="sm:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>
            Photos du produit ({images.length}/{MAX_PRODUCT_IMAGES})
          </Label>
          <span className="text-xs text-muted-foreground">1 à 5 photos — JPEG, PNG ou WebP</span>
        </div>
        <input type="hidden" name="image_urls" value={JSON.stringify(images)} />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => void addFiles(event.target.files)}
        />
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <div
              key={image}
              className="group relative aspect-square overflow-hidden rounded-md border bg-card"
            >
              <img src={image} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((current) => current.filter((entry) => entry !== image))}
                aria-label={`Retirer la photo ${index + 1}`}
                disabled={busy}
                className="absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-background/90 text-destructive shadow"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, MAX_PRODUCT_IMAGES - images.length) }).map(
            (_, index) => (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="grid aspect-square place-items-center rounded-md border border-dashed text-muted-foreground hover:border-primary hover:text-primary"
                aria-label="Ajouter une photo"
              >
                {busy ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <ImagePlus className="size-6" />
                )}
              </button>
            ),
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-52 flex-1">
            <Label htmlFor="image-url" className="text-xs">
              Ajouter par URL
            </Label>
            <Input
              id="image-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://exemple.com/photo.jpg"
            />
          </div>
          <Button type="button" variant="outline" onClick={addUrl} disabled={busy || !url.trim()}>
            <Link2 /> Ajouter l'URL
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy || images.length >= MAX_PRODUCT_IMAGES}
          >
            <ImagePlus /> Choisir des photos
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Field label="Saveurs (séparées par des virgules)">
          <Input name="flavors" defaultValue={product.flavors.join(", ")} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea name="description" rows={5} defaultValue={product.description ?? ""} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="featured" name="is_featured" defaultChecked={product.is_featured} />
        <Label htmlFor="featured">Produit mis en avant</Label>
      </div>
    </div>
  );
}

async function toLogoPayload(
  file: File,
): Promise<{ contentType: "image/png" | "image/jpeg" | "image/webp"; data: string }> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type))
    throw new Error("Format non supporté. Utilisez PNG, JPEG ou WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Logo trop lourd (max 10 Mo avant compression).");

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Compression impossible dans ce navigateur.");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const png = canvas.toDataURL("image/png");
    if (png.length <= 5_000_000) return { contentType: "image/png", data: png.split(",")[1] ?? "" };
    // Very large transparent logo: fall back to JPEG on white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.9);
    return { contentType: "image/jpeg", data: jpeg.split(",")[1] ?? "" };
  } catch (error) {
    if (file.size > 4 * 1024 * 1024)
      throw error instanceof Error ? error : new Error("Logo trop lourd (max 4 Mo).");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });
    return {
      contentType: file.type as "image/png" | "image/jpeg" | "image/webp",
      data: dataUrl.split(",")[1] ?? "",
    };
  }
}

export function PartnerFields({ partner }: { partner?: Tables<"partners"> | undefined }) {
  const upload = useServerFn(uploadPartnerLogo);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(partner?.logo_url ?? "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addUrl() {
    const candidate = url.trim();
    if (!isAllowedPartnerLogoUrl(candidate)) {
      setError("URL invalide : utilisez https://… ou un logo uploadé.");
      return;
    }
    setLogoUrl(candidate);
    setUrl("");
    setError("");
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const payload = await toLogoPayload(file);
      const result = await upload({ data: payload });
      setLogoUrl(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload impossible.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Logo du partenaire</Label>
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void uploadLogo(event.target.files?.[0])}
        />
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div className="grid size-24 shrink-0 place-items-center rounded-lg bg-white p-2">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo du partenaire"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImagePlus className="size-8 text-neutral-400" />
            )}
          </div>
          <div className="min-w-56 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Choisir un logo
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLogoUrl("")}
                  disabled={busy}
                >
                  <Trash2 /> Retirer
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://exemple.com/logo.png"
                aria-label="URL du logo"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addUrl}
                disabled={busy || !url.trim()}
              >
                <Link2 /> Ajouter l'URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              PNG/JPEG/WebP, redimensionné à 600 px max. Affiché sur le site public.
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <Field label="Nom de la salle">
        <Input name="name" required defaultValue={partner?.name ?? ""} />
      </Field>
      <Field label="Ville">
        <Input name="location" defaultValue={partner?.location ?? ""} />
      </Field>
      <Field label="Code partenaire">
        <Input name="discount_code" defaultValue={partner?.discount_code ?? ""} />
      </Field>
      <Field label="Remise partenaire (%)">
        <Input
          type="number"
          min={0}
          max={90}
          step={1}
          name="discount_percent"
          defaultValue={partner?.discount_percent ?? 10}
          required
        />
      </Field>
      <Field label="Ordre d’affichage">
        <Input
          type="number"
          min={0}
          step={1}
          name="display_order"
          defaultValue={partner?.display_order ?? 0}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Adresse">
          <Input name="address" defaultValue={partner?.address ?? ""} />
        </Field>
      </div>
      <Field label="Site web">
        <Input
          type="url"
          name="website_url"
          defaultValue={partner?.website_url ?? ""}
          placeholder="https://"
        />
      </Field>
      <Field label="Instagram">
        <Input
          type="url"
          name="instagram_url"
          defaultValue={partner?.instagram_url ?? ""}
          placeholder="https://"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea rows={3} name="description" defaultValue={partner?.description ?? ""} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="active" name="is_active" defaultChecked={partner?.is_active ?? true} />
        <Label htmlFor="active">Partenaire actif</Label>
      </div>
    </div>
  );
}

export function CategoryFields({ category }: { category?: Tables<"categories"> | undefined }) {
  const upload = useServerFn(uploadCategoryImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(category?.image_url ?? "");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function addUrl() {
    const candidate = url.trim();
    if (!isAllowedCategoryImageUrl(candidate)) {
      setError("URL invalide : utilisez https://… ou une image uploadée.");
      return;
    }
    setImageUrl(candidate);
    setUrl("");
    setError("");
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const payload = await toLogoPayload(file);
      const result = await upload({ data: payload });
      setImageUrl(result.url);
      if (fileRef.current) fileRef.current.value = "";
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload impossible.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Image de la catégorie (affichée en boutique)</Label>
        <input type="hidden" name="image_url" value={imageUrl} />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void uploadImage(event.target.files?.[0])}
        />
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border bg-secondary">
            {imageUrl ? (
              <img src={imageUrl} alt="Image de la catégorie" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="size-8 text-neutral-400" />
            )}
          </div>
          <div className="min-w-56 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} Choisir une image
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setImageUrl("")}
                  disabled={busy}
                >
                  Retirer
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://exemple.com/image.jpg"
                aria-label="URL de l'image"
                className="min-w-40 flex-1"
              />
              <Button type="button" variant="outline" onClick={addUrl} disabled={busy || !url.trim()}>
                Ajouter l'URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG/PNG/WebP, redimensionnée à 600 px max. Affichée sur le site public.
            </p>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      </div>
      <Field label="Nom de la catégorie">
        <Input name="name" required minLength={2} maxLength={120} defaultValue={category?.name ?? ""} />
      </Field>
      <Field label="Ordre d’affichage">
        <Input
          type="number"
          min={0}
          step={1}
          name="display_order"
          defaultValue={category?.display_order ?? 0}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Description">
          <Textarea rows={2} name="description" maxLength={1000} defaultValue={category?.description ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export type AdminOrder = Tables<"orders"> & { order_items: Tables<"order_items">[] };
export function OrderFields({ order }: { order: AdminOrder }) {
  const address =
    order.shipping_address &&
    typeof order.shipping_address === "object" &&
    !Array.isArray(order.shipping_address)
      ? order.shipping_address
      : {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-semibold">{order.customer_name}</p>
          <a className="text-primary" href={`tel:${order.customer_phone}`}>
            {order.customer_phone}
          </a>
          <a
            className="mt-1 block text-sm text-success hover:underline"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/212${order.customer_phone.replace(/\D/g, "").slice(-9)}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, Protein Store confirme votre commande ${order.order_number} (${mad(order.total)}, paiement à la livraison).`)}`}
          >
            Confirmer sur WhatsApp
          </a>
          <p className="break-all text-sm text-muted-foreground">{order.customer_email}</p>
        </div>
        <div className="text-sm">
          <p>{String(address["address"] ?? "")}</p>
          <p>
            {String(address["city"] ?? "")} {String(address["postal"] ?? "")}
          </p>
          <p className="mt-2 text-muted-foreground">Paiement à la livraison</p>
        </div>
      </div>
      <div className="divide-y border-y">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 py-3 text-sm">
            <span>
              {item.quantity} × {item.product_title}
              <small className="block text-muted-foreground">{item.variant_name}</small>
            </span>
            <span className="shrink-0 font-mono">
              {mad(item.quantity * item.price_at_purchase)}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-1 text-sm">
        <p className="flex justify-between">
          <span>Sous-total</span>
          <span>{mad(order.subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span>Livraison</span>
          <span>{mad(order.shipping_cost)}</span>
        </p>
        <p className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{mad(order.total)}</span>
        </p>
      </div>
      {order.notes && <p className="text-sm text-muted-foreground">Note client : {order.notes}</p>}
      <Choice
        label="Statut"
        name="status"
        value={order.status}
        options={orderStatusSchema.options.map((s) => ({ value: s, label: statusLabels[s] }))}
      />
      <Field label="Notes internes">
        <Textarea name="admin_notes" rows={3} defaultValue={order.admin_notes ?? ""} />
      </Field>
    </div>
  );
}
