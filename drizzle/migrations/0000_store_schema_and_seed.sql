CREATE TYPE public.app_role AS ENUM ('admin','customer');
CREATE TYPE public.order_status AS ENUM ('pending','confirmed','shipped','delivered','cancelled');

CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, full_name text, phone text, city text, address text, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile upd" ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid());
CREATE POLICY "own profile ins" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id=auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(id,full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'customer') ON CONFLICT DO NOTHING;
  IF lower(NEW.email)='admin@proteinestore.ma' THEN INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE TABLE public.categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE, description text, image_url text, display_order int NOT NULL DEFAULT 0);
GRANT SELECT ON public.categories TO anon, authenticated; GRANT INSERT,UPDATE,DELETE ON public.categories TO authenticated; GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "cat admin" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, slug text NOT NULL UNIQUE, description text, brand text, category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL, price int NOT NULL CHECK(price>=0), sale_price int, stock_quantity int NOT NULL DEFAULT 0, low_stock_threshold int NOT NULL DEFAULT 5, sku text, image_urls text[] NOT NULL DEFAULT '{}', flavors text[] NOT NULL DEFAULT '{}', nutrition_facts jsonb NOT NULL DEFAULT '[]', is_featured boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'published', rating numeric(2,1) NOT NULL DEFAULT 0, review_count int NOT NULL DEFAULT 0, sold_count int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.products TO anon, authenticated; GRANT INSERT,UPDATE,DELETE ON public.products TO authenticated; GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod read" ON public.products FOR SELECT USING (status='published' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "prod admin" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.partners(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, location text, address text, description text, logo_url text, website_url text, instagram_url text, discount_code text, is_active boolean NOT NULL DEFAULT true, display_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.partners TO anon, authenticated; GRANT INSERT,UPDATE,DELETE ON public.partners TO authenticated; GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner read" ON public.partners FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "partner admin" ON public.partners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.campaigns(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, discount_type text NOT NULL DEFAULT 'percent', discount_value int NOT NULL, applies_to_type text NOT NULL DEFAULT 'all', category_ids uuid[] NOT NULL DEFAULT '{}', product_ids uuid[] NOT NULL DEFAULT '{}', start_date timestamptz NOT NULL DEFAULT now(), end_date timestamptz NOT NULL, priority int NOT NULL DEFAULT 5, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.campaigns TO anon, authenticated; GRANT INSERT,UPDATE,DELETE ON public.campaigns TO authenticated; GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "camp read" ON public.campaigns FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "camp admin" ON public.campaigns FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE, user_id uuid, customer_name text NOT NULL, customer_email text, customer_phone text NOT NULL, shipping_address jsonb NOT NULL, subtotal int NOT NULL, shipping_cost int NOT NULL, total int NOT NULL, payment_method text NOT NULL DEFAULT 'cod', status public.order_status NOT NULL DEFAULT 'pending', notes text, admin_notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated; GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order own read" ON public.orders FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "order admin upd" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "order admin del" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, product_id uuid REFERENCES public.products(id) ON DELETE SET NULL, product_title text NOT NULL, variant_name text, quantity int NOT NULL, price_at_purchase int NOT NULL);
GRANT SELECT ON public.order_items TO authenticated; GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items read" ON public.order_items FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES public.products(id) ON DELETE CASCADE, user_id uuid, author_name text NOT NULL, city text, rating int NOT NULL CHECK(rating BETWEEN 1 AND 5), comment text NOT NULL, is_verified boolean NOT NULL DEFAULT false, is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.reviews TO anon, authenticated; GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated; GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev read" ON public.reviews FOR SELECT USING (is_approved OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rev ins" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid() AND is_verified=false);
CREATE POLICY "rev admin" ON public.reviews FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.subscribers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.subscribers TO anon, authenticated; GRANT SELECT ON public.subscribers TO authenticated; GRANT ALL ON public.subscribers TO service_role;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub ins" ON public.subscribers FOR INSERT TO anon, authenticated WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
CREATE POLICY "sub admin" ON public.subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.categories(slug,name,display_order) VALUES
('whey','Whey & Protéines',0),('gainers','Gainers',1),('creatine','Créatine',2),('pre-workout','Pré-Workout',3),('acides-amines','BCAA & Acides Aminés',4),('bruleurs','Brûleurs de graisse',5),('sante','Vitamines & Santé',6),('barres','Barres & Snacks',7);

INSERT INTO public.products(category_id,title,slug,brand,price,sale_price,stock_quantity,is_featured,rating,review_count,sold_count,description,sku)
SELECT c.id, v.t, v.s, v.b, v.p, v.sp, v.st, v.f, v.r, v.rc, v.sc, v.t || '. Produit 100% authentique, importé et vérifié. Paiement à la livraison partout au Maroc.', 'PS-' || (1000 + row_number() OVER ())
FROM (VALUES
('whey','ISOWHEY Best Isolat 2kg – 66 Doses – HX Nutrition (Mélange Whey Concentrée + Isolat)','isowhey-best-isolat-2kg-hx-nutrition','HX Nutrition',1000,849,0,true,4.5,22,207),
('whey','Organic Protein 20g – Protéine Végétale Bio – Rich Decadent 560g – Purely Inspired','organic-protein-vegetale-bio-chocolat-560g-purely-inspired','Purely Inspired',400,349,4,false,4.4,71,53),
('whey','CBUM Itholate Protein 25 Doses – Raw Nutritional (25g Whey Isolate par dose)','cbum-itholate-protein','Raw Nutritional',800,699,25,false,4.7,67,114),
('whey','ISO 100 Hydrolyzed 610g Dymatize – 100% Whey Protein Isolate Hydrolysé','dymatize-iso-100-hydrolyzed-610g','Dymatize',700,599,4,false,4.4,56,40),
('whey','Lazar Angelov Whey Concentrate 2270g – 78% Protéine, 23g/dose, 75 doses','whey-protein-concentrate-2-27kg-lazar-angelov','Lazar Angelov',800,699,12,false,4.4,57,35),
('whey','Iso Whey Zero Biotech USA 1 Serving','iso-whey-zero-biotech-usa-1-serving','Biotech USA',35,29,60,true,4.4,31,36),
('whey','Nitro-Tech® Ripped 1.81kg – Muscletech (30g Protéine, 44 doses)','nitro-tech-whey-ripped-18kg-muscletech','Muscletech',999,799,60,false,4.7,9,118),
('whey','Nitro-Tech® Whey Gold 2.27kg – Muscletech (24g Protéine, 67 doses)','nitro-tech-whey-gold-227kg-muscletech','Muscletech',999,899,4,false,4.7,20,153),
('whey','ISO 100 Hydrolyzed 1.37kg Dymatize – Whey Isolate Hydrolysé (42 doses)','iso-100-hydrolised-whey-14kg-dymatize','Dymatize',1200,1029,40,false,4.4,18,297),
('whey','Lazar Angelov ISOWHEY 1.6kg – Whey Isolate + Hydrolysé (64 doses)','iso-whey-hydrolised-16kg-lazar-angelov-nutrition','Lazar Angelov',1200,699,0,false,4.5,26,57),
('gainers','Critical Mass Professional 2.4kg Applied Nutrition – Lean Mass Gainer','critical-mass-professional-2-4kg-applied-nutrition','Applied Nutrition',599,NULL,60,true,4.7,27,195),
('gainers','Cream Of Rice 2kg – Applied Nutrition','cream-of-rice-2kg-applied-nutrition','Applied Nutrition',500,429,4,false,4.7,11,293),
('gainers','Super Mass Gainer 5.4Kg (12 LB) – Dymatize (16 portions, 1280 cal)','super-mass-gainer-5-5kg-dymatize','Dymatize',1000,949,4,false,4.7,66,277),
('creatine','100% Creatine Monohydrate 500g 147 Servings – Biotech USA','100-creatine-monohydrate-500g-147-servings-biotech-usa','Biotech USA',500,399,40,false,4.8,62,237),
('creatine','100% Creatine Monohydrate Micronized 250g – Applied Nutrition (83 doses)','100-creatine-monohydrate-50-servings-applied-nutrition','Applied Nutrition',500,349,25,false,4.5,26,129),
('creatine','100% Creatine Monohydrate Micronized 500g – Applied Nutrition (166 doses)','100-creatine-monohydrate-500g-applied-nutrition','Applied Nutrition',700,449,4,true,4.7,70,258),
('creatine','Créatine Monohydrate 300g – BiotechUSA Original (88 doses)','100-creatine-monohydrate-300g-biotech-usa','Biotech USA',400,349,25,false,4.8,39,42),
('creatine','Créatine Monohydrate 300g – DY Nutrition (Dorian Yates)','100-creatine-monohydrate-300g-dorian-yats-new','DY Nutrition',350,299,4,false,4.7,24,180),
('creatine','Créatine Monohydrate 300g – HX Nutrition Nature (Vegan, 66 doses)','certifier-100-creatine-monohydrate-300g-hx-nutrition','HX Nutrition',250,199,0,false,4.4,65,220),
('creatine','Créatine Monohydrate 300g – Lazar Angelov Nutrition (100 doses)','100-creatine-monohydrate-300g-lazar-angelov','Lazar Angelov',350,250,4,false,5.0,12,290),
('pre-workout','ABE Performance Energy Drink 330ml – Applied Nutrition','abe-performance-energy-drink-330ml-applied-nutrition','Applied Nutrition',29,NULL,60,true,4.9,43,179),
('pre-workout','ABE Ultimate Pre-Workout 375g – Applied Nutrition (30 doses)','abe-ultimate-pre-workout-375g-applied-nutrition','Applied Nutrition',500,449,25,false,4.7,77,238),
('pre-workout','Blood & Guts Pre-Workout 398g – DY Nutrition (20 doses)','blood-guts-pre-workout-398g-dy-nutrition','DY Nutrition',550,449,4,false,4.9,37,247),
('bruleurs','Hydroxycut Hardcore Elite MuscleTech 110 Capsules','muscletech-hydroxycut-hardcore-elite-110-capsules','Muscletech',500,399,4,false,4.3,42,300),
('sante','Ashwagandha 1000 – 90 Vege Caps – HIRO.LAB','ashwagandha-1000-90-vege-caps-hiro-lab','HIRO.LAB',350,299,40,false,4.5,52,182),
('sante','Berberine HCL 450mg – 60 Vege Caps – HIRO.LAB','berberine-hcl-450mg-60-vege-caps-hiro-lab','HIRO.LAB',450,349,4,true,5.0,48,91),
('sante','CollagenUP – Collagène Marin + Acide Hyaluronique – 206g – California Gold Nutrition','collagenup-collagene-marin-hyaluronique-vitamine-c-california-gold','California Gold',500,399,60,false,4.4,10,116),
('sante','Maca 500mg – 100 Veg Capsules – NOW Foods','maca-500mg-100-veg-capsules-now-foods','NOW Foods',350,299,0,false,4.8,19,131),
('sante','Magnesium Bisglycinate Powder 227g – NOW Foods','magnesium-bisglycinate-powder-227g-now-foods','NOW Foods',550,449,40,false,4.6,66,46),
('sante','Magnesium Citrate 200mg – 100 Comprimés – NOW Foods','magnesium-citrate-200mg-100-comprimes-now-foods','NOW Foods',380,299,12,false,4.6,73,147),
('sante','Magnesium Glycinate – 120 Capsules – Revive MD','magnesium-glycinate-120-capsules-revive-md','Revive MD',450,349,12,true,4.9,73,147),
('sante','Magnesium Glycinate – 180 Comprimés – NOW Foods','magnesium-glycinate-180-comprimes-now-foods','NOW Foods',349,NULL,40,false,5.0,51,123),
('sante','Melatonin 10mg Extra Strength – 100 Veg Capsules – NOW Foods','melatonin-extra-10mg-100-capsules-now-food','NOW Foods',500,349,12,false,4.4,22,123),
('sante','MuscleTech Platinum Multivitamin – 90 Comprimés','muscletech-platinum-multivitamin','Muscletech',350,289,12,false,4.3,78,98),
('sante','Omega 3 1000mg – 60 Caps – Nutrend','omega-3-1000mg-fish-oil-60-caps-nutrend','Nutrend',350,249,25,false,4.5,21,219),
('sante','Omega-3 1000mg – 90 Softgels – AMS','omega-3-1000mg-90-softgels-ams-america-medic-science','AMS',350,299,60,true,4.6,75,168),
('sante','Omega-3 Fish Oil 1000mg – 200 Softgels – NOW Foods','omega-3-fish-oil-1000mg-200-softgels-now-foods','NOW Foods',299,NULL,0,false,5.0,68,32),
('sante','Vitamin D3+K2 120 Capsules – NOW Foods','vitamin-d3k2-120-capsules-now-food','NOW Foods',400,299,40,false,4.9,74,205),
('sante','Vitamine D3 + K2 MK7 4000 IU – 160 Comprimés – HIRO.LAB','vitamine-d3-k2-mk7-4000iu-160-tabs-hiro-lab','HIRO.LAB',250,199,40,false,4.6,16,251),
('sante','Vitamine D3 10 000 UI – NOW Foods 120 Softgels','vitamine-d3-10000-ui-now-foods-120-softgels','NOW Foods',400,299,40,false,4.3,11,111),
('sante','Zinc 50mg – 250 Comprimés – NOW Foods','zinc-50mg-250-comprimes-now-foods','NOW Foods',350,289,40,true,4.4,46,31),
('sante','Zinc Picolinate 50mg – 120 Vege Caps – HIRO.LAB','zinc-picolinate-50mg-120-vege-caps-hiro-lab','HIRO.LAB',350,289,4,false,4.3,22,279),
('sante','VIT/AMINO 300g – Lazar Angelov Nutrition','vit-amino-300g-lazar-angelov-nutrition','Lazar Angelov',400,349,4,false,5.0,6,41),
('sante','Magnesium Plus – Vhealth 10 tabs','magnesium-plus-vhealth-supplements-10tabs','Vhealth',100,49,12,false,4.7,22,134),
('sante','Multivitamin For Men 60 Tablets – BiotechUSA','multivitamin-for-men-biotech-usa','Biotech USA',350,299,25,false,4.7,63,67),
('sante','Multivits & Minerals 60 Caps – Grassberg Germany','multivits-minerals-90-caps-grassberg-germany','Grassberg',500,299,0,true,4.4,65,243),
('sante','ONE-A-DAY Multivitamines 100 Comprimés – Biotech USA','one-a-day-100-tabs-biotech-usa','Biotech USA',300,249,40,false,4.6,13,78),
('sante','Vita Boost Hydration – Vhealth 10 tabs','vita-boost-hydration-vhealth-supplements-10tabs','Vhealth',100,49,4,false,4.8,36,250),
('sante','Zinc Duo 25mg – BioTechUSA 60 Comprimés','zinc-duo-25mg-biotech-usa','Biotech USA',350,249,12,false,4.7,29,275),
('sante','Zinc Picolinate 50mg – 120 Veg Capsules – NOW Foods','zinc-picolinate-50mg-now-food-120-cap','NOW Foods',249,NULL,25,false,4.4,72,18),
('sante','Zinc Vegan 10mg – Natures Plus','zinc-vegan-10mg-natures-plus','Natures Plus',250,199,60,true,4.5,14,138),
('sante','Mega Omega-3 90 Softgels – BiotechUSA','omega-3-biotech-usa','Biotech USA',500,249,60,false,4.6,24,187),
('acides-amines','BCAA + Glutamine – Lazar Angelov Nutrition (2:1:1)','bcaa-amino-acids-lazar-angelov-nutrition','Lazar Angelov',350,249,12,false,4.7,67,173),
('acides-amines','Essential Amino Powder 390g – Lazar Angelov Nutrition (55 doses)','eaa-amino-390-angelov-nutrition','Lazar Angelov',400,299,12,false,4.7,27,127),
('acides-amines','HIT EAA 360g – DY Nutrition (30 portions)','eaa-hit-zero-360g-dorian-yates','DY Nutrition',400,329,0,false,4.9,32,107),
('acides-amines','RedCon1 GRUNT – EAA 30 Doses (Non-Stim)','redcon1-grunt-eaa','RedCon1',400,349,60,true,4.6,6,19),
('acides-amines','100% Pure Citrulline 300g – Extrifit','citrulline-pure-300g-extrifit','Extrifit',500,389,25,false,4.6,27,181),
('barres','Barre Protéinée JoyFuel 55g – 20g de Protéines','barre-proteinee-joyfuel-55g','JoyFuel',25,NULL,40,false,4.9,47,191)
) AS v(cs,t,s,b,p,sp,st,f,r,rc,sc) JOIN public.categories c ON c.slug=v.cs;

INSERT INTO public.partners(name,location,address,discount_code,display_order,description) VALUES
('PowerGym Kenitra','Kénitra','Kénitra','POWERGYM',1,'Salle de musculation et cardio'),
('PRO''FIT','Kénitra','Villa sur 2 étages, Kénitra','PROFIT',2,'Équipements Technogym, Life Fitness, Hammer Strength'),
('Jimmy''s Fitness Center','Résidence Royale','38 Ave Hassan II, Kénitra','JIMMYS',3,'Fitness center au cœur de la ville'),
('Esprit Fitness','Centre Ville','Centre Ville, Kénitra','ESPRIT',4,'1200m², piscine, espace femmes'),
('Oxygym','Kénitra','Rue Moussa Ibnou Nousair, Kénitra','OXYGYM',5,'Salle réservée aux hommes'),
('Orange Health Club','Centre','Centre ville, Kénitra','ORANGE',6,'Health club complet'),
('Planet Gym','Riad Al Andalouss','N°2 Bd Abou Bakr Essedik, Kénitra','PLANET',7,'Musculation et cours collectifs'),
('m Wellness – Club Moving','Maamora','N°33 Ave Idriss Al Akbar, Maamora','MOVING',8,'Wellness & fitness'),
('Lifestyle Club','Maamoura','Résidence N°5, Maghreb Arabi C, Maamoura','LIFESTYLE',9,'Club lifestyle premium');

INSERT INTO public.campaigns(name,discount_type,discount_value,applies_to_type,start_date,end_date,priority) VALUES
('Soldes d''Automne','percent',10,'all',now()-interval '1 day',now()+interval '9 days',5);

INSERT INTO public.reviews(author_name,city,rating,comment,is_verified) VALUES
('Youssef B.','Kénitra',5,'Livraison en 24h à Kénitra, produit authentique. Je recommande !',true),
('Salma A.','Rabat',5,'Service top, paiement à la livraison sans souci. Ma whey isolate est parfaite.',true),
('Hamza E.','Casablanca',5,'Meilleurs prix que j''ai trouvés au Maroc, et vrais produits.',true),
('Imane K.','Salé',4,'Très bon conseil sur WhatsApp pour choisir ma créatine. Livraison rapide.',true),
('Mehdi R.','Kénitra',5,'Membre chez PRO''FIT, j''ai eu ma remise partenaire. Top !',true);