-- ---- labs.header_image_url -------------------------------------------------
-- A finished banner graphic (Saudi Experience Labs mark + lab-type wordmark
-- + "in partnership with X" text, all baked into one image) that replaces
-- the header's plain-text lab name and partner block when set. Admin-edited
-- per lab via the same free-text URL pattern as logo_url/partner_logo_url —
-- also accepts a same-origin path like "/brand/lab-headers/culinary.png" for
-- banners bundled into the app itself rather than hosted elsewhere.
alter table public.labs
  add column if not exists header_image_url text;

-- Seed the 4 banners supplied for the labs whose names match. Uses ilike so
-- it doesn't matter whether the lab is named "Architecture Experience Lab",
-- "ARCHITECTURE EXPERIENCE LAB", or similar — only the keyword must appear.
update public.labs set header_image_url = '/brand/lab-headers/architecture.png'
  where name ilike '%architecture%' and header_image_url is null;

update public.labs set header_image_url = '/brand/lab-headers/authenticity.png'
  where name ilike '%authenticity%' and header_image_url is null;

update public.labs set header_image_url = '/brand/lab-headers/culinary.png'
  where name ilike '%culinary%' and header_image_url is null;

update public.labs set header_image_url = '/brand/lab-headers/musical.png'
  where name ilike '%musical%' and header_image_url is null;
