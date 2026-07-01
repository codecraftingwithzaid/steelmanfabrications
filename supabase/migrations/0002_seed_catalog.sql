-- =====================================================================
-- Seed: item categories + descriptions
-- Idempotent — safe to re-run. Descriptions match src/lib/catalog.ts.
-- =====================================================================

insert into public.item_categories (name) values ('fabrication'), ('aluminium')
on conflict (name) do nothing;

-- Fabrication ---------------------------------------------------------
with cat as (select id from public.item_categories where name = 'fabrication')
insert into public.item_descriptions (category_id, label, sort_order)
select cat.id, d.label, d.ord
from cat,
  (values
    ('MS Grill Work', 1),
    ('SS Handrail', 2),
    ('MS Staircase Railing', 3),
    ('MS Gate Fabrication', 4),
    ('MS Window Grill', 5),
    ('MS Door Frame', 6),
    ('Powder Coating', 7),
    ('Welding Work', 8),
    ('Labour Charges', 9),
    ('Transportation Charges', 10)
  ) as d(label, ord)
where not exists (
  select 1 from public.item_descriptions x
  where x.category_id = cat.id and x.label = d.label
);

-- Aluminium -----------------------------------------------------------
with cat as (select id from public.item_categories where name = 'aluminium')
insert into public.item_descriptions (category_id, label, sort_order)
select cat.id, d.label, d.ord
from cat,
  (values
    ('Balcony SS Railing (SS Studs 304, 50×50mm SS Top 304, 12mm Toughened Glass)', 1),
    ('Stairs Glass Railing (SS Studs 304, 50×50mm SS Top 304, 12mm Toughened Glass Railing)', 2),
    ('MAAN Aluminium Sliding Windows System (27×65mm Series Domal, 16 Gauge White Powder Coat, 5mm Clear Toughened Glass)', 3),
    ('Balcony Slider 6 Shutter Windows (27×65mm Series Domal, 16 Gauge White Powder Coat, 5mm Clear Toughened Glass)', 4),
    ('Fixed Glass (40mm Outer Frame, 8mm Clear Toughened Glass)', 5),
    ('Openable Windows (40mm Series Openable Frame, 8mm Clear Toughened Glass)', 6),
    ('SS Square Pipe Railing', 7),
    ('Aluminium Sliding Door', 8),
    ('Aluminium Casement Door', 9),
    ('Aluminium Partition', 10),
    ('Aluminium Curtain Wall', 11),
    ('Aluminium Composite Panel (ACP) Cladding', 12),
    ('Aluminium Louver', 13),
    ('Spider Glass Fitting', 14),
    ('Glass Work', 15),
    ('Labour Charges', 16),
    ('Transportation Charges', 17)
  ) as d(label, ord)
where not exists (
  select 1 from public.item_descriptions x
  where x.category_id = cat.id and x.label = d.label
);
