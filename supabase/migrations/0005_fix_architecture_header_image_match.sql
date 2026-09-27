-- 0004 matched labs.name against '%architecture%', which doesn't match a
-- lab named e.g. "Architectural Experience Lab" — "architecture" and
-- "architectural" share a prefix but aren't substrings of each other.
-- Widen to '%architect%', which matches either wording (and doesn't risk
-- colliding with the other three: authenticity/culinary/musical).
update public.labs set header_image_url = '/brand/lab-headers/architecture.png'
  where name ilike '%architect%' and header_image_url is null;
