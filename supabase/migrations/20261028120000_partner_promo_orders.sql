-- Promos partenaires + remises commande (2026-10-28)
-- À appliquer sur le projet Supabase de production.

alter table public.partners
  add column if not exists discount_percent int not null default 10;

alter table public.orders
  add column if not exists discount int not null default 0;
alter table public.orders
  add column if not exists promo_code text;
alter table public.orders
  add column if not exists promo_label text;

-- Les codes promo doivent rester activables/désactivables par la boutique.
-- `is_active` sur partners contrôle déjà la validité d'un code.
