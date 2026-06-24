ALTER TABLE public.programas ADD COLUMN IF NOT EXISTS nemonico text;
CREATE UNIQUE INDEX IF NOT EXISTS programas_nemonico_key ON public.programas (lower(nemonico)) WHERE nemonico IS NOT NULL;