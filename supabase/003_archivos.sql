-- 003_archivos.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor

-- 1. Eliminar la tabla si existe para recrearla con los tipos correctos
DROP TABLE IF EXISTS public.reclamo_archivos;

-- 2. Crear tabla con tipos asimétricos (UUID para reclamos, INTEGER para sugerencias)
CREATE TABLE public.reclamo_archivos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reclamo_id UUID REFERENCES public.reclamos(id) ON DELETE CASCADE,
  sugerencia_id INTEGER REFERENCES public.sugerencias(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'pdf', 'documento')),
  storage_path text NOT NULL,
  nombre_original text,
  created_at timestamptz DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_reclamo_archivos_reclamo_id ON public.reclamo_archivos(reclamo_id);
CREATE INDEX IF NOT EXISTS idx_reclamo_archivos_sugerencia_id ON public.reclamo_archivos(sugerencia_id);

-- 4. Habilitar RLS
ALTER TABLE public.reclamo_archivos ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar archivos" ON public.reclamo_archivos;
CREATE POLICY "Usuarios autenticados pueden insertar archivos"
ON public.reclamo_archivos FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Todos pueden ver archivos" ON public.reclamo_archivos;
CREATE POLICY "Todos pueden ver archivos"
ON public.reclamo_archivos FOR SELECT TO anon, authenticated
USING (true);

-- 6. Storage Buckets (ensure they are public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reclamos-fotos', 'reclamos-fotos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('reclamos-documentos', 'reclamos-documentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Storage Policies
-- Policy for reclamos-fotos
DROP POLICY IF EXISTS "Anyone can view files in reclamos-fotos" ON storage.objects;
CREATE POLICY "Anyone can view files in reclamos-fotos" ON storage.objects 
    FOR SELECT TO public USING ( bucket_id = 'reclamos-fotos' );

DROP POLICY IF EXISTS "Authenticated users can upload files to reclamos-fotos" ON storage.objects;
CREATE POLICY "Authenticated users can upload files to reclamos-fotos" ON storage.objects 
    FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'reclamos-fotos' );

DROP POLICY IF EXISTS "Public Access reclamos-fotos" ON storage.objects;
CREATE POLICY "Public Access reclamos-fotos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reclamos-fotos');

-- Policy for reclamos-documentos
DROP POLICY IF EXISTS "Anyone can view files in reclamos-documentos" ON storage.objects;
CREATE POLICY "Anyone can view files in reclamos-documentos" ON storage.objects 
    FOR SELECT TO public USING ( bucket_id = 'reclamos-documentos' );

DROP POLICY IF EXISTS "Authenticated users can upload files to reclamos-documentos" ON storage.objects;
CREATE POLICY "Authenticated users can upload files to reclamos-documentos" ON storage.objects 
    FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'reclamos-documentos' );

DROP POLICY IF EXISTS "Public Access reclamos-documentos" ON storage.objects;
CREATE POLICY "Public Access reclamos-documentos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reclamos-documentos');

-- 8. REFRESCAR SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
