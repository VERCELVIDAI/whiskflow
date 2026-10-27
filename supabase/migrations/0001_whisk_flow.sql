-- Whisk Flow production schema for Supabase PostgreSQL.
-- Run this migration once in the Supabase SQL editor before starting the app.
-- The application connects with DATABASE_URL and enforces ownership in every
-- query. RLS is enabled as defense-in-depth for direct Supabase clients.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  credits INTEGER NOT NULL DEFAULT 1200 CHECK (credits >= 0),
  reserved_credits INTEGER NOT NULL DEFAULT 0 CHECK (reserved_credits >= 0),
  billing_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS billing_customer_id TEXT;

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'video',
  status TEXT NOT NULL DEFAULT 'draft',
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  provider TEXT,
  model TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  export_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  cover_asset_id UUID,
  template_slug TEXT,
  is_example BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON public.projects(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_owner_deleted_idx ON public.projects(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS projects_owner_favorite_idx ON public.projects(owner_id, favorite) WHERE favorite = TRUE;

CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  scene_id UUID,
  kind TEXT NOT NULL DEFAULT 'image',
  title TEXT NOT NULL DEFAULT 'Untitled asset',
  url TEXT,
  thumbnail_url TEXT,
  storage_provider TEXT NOT NULL DEFAULT 'local',
  storage_path TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_seconds NUMERIC(8, 2),
  prompt TEXT,
  negative_prompt TEXT,
  provider TEXT,
  model TEXT,
  aspect_ratio TEXT,
  source TEXT NOT NULL DEFAULT 'upload',
  folder TEXT NOT NULL DEFAULT 'Unsorted',
  tags TEXT[] NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_example BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_owner_created_idx ON public.assets(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS assets_owner_kind_idx ON public.assets(owner_id, kind);
CREATE INDEX IF NOT EXISTS assets_owner_favorite_idx ON public.assets(owner_id, favorite) WHERE favorite = TRUE;
CREATE INDEX IF NOT EXISTS assets_project_idx ON public.assets(project_id);
CREATE INDEX IF NOT EXISTS assets_owner_deleted_idx ON public.assets(owner_id, deleted_at);
CREATE INDEX IF NOT EXISTS assets_search_idx
  ON public.assets USING GIN (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(prompt, '')));

CREATE TABLE IF NOT EXISTS public.scenes (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled scene',
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 4 CHECK (duration_seconds BETWEEN 1 AND 20),
  order_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  reference_asset_ids UUID[] NOT NULL DEFAULT '{}',
  first_frame_asset_id UUID,
  last_frame_asset_id UUID,
  transition TEXT NOT NULL DEFAULT 'cut',
  thumbnail_url TEXT,
  video_asset_id UUID,
  generation_job_id UUID,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scenes_project_order_idx ON public.scenes(project_id, order_index);
CREATE INDEX IF NOT EXISTS scenes_owner_idx ON public.scenes(owner_id);

CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  prompt TEXT NOT NULL,
  negative_prompt TEXT NOT NULL DEFAULT '',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_count INTEGER NOT NULL DEFAULT 1,
  credits_reserved INTEGER NOT NULL DEFAULT 0,
  provider_job_id TEXT,
  result_asset_id UUID,
  asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS jobs_owner_created_idx ON public.generation_jobs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.generation_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS jobs_project_idx ON public.generation_jobs(project_id);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  reserved_delta INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_transactions_owner_created_idx
  ON public.credit_transactions(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_transactions_generation_idx
  ON public.credit_transactions(generation_id);

CREATE TABLE IF NOT EXISTS public.exports (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exports_project_idx ON public.exports(project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Billing orders, subscriptions and webhook idempotency
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_orders (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'credits')),
  plan_id TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_session_id TEXT,
  provider_payment_id TEXT,
  provider_customer_id TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS billing_orders_owner_created_idx
  ON public.billing_orders(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_orders_session_idx
  ON public.billing_orders(provider_session_id);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'incomplete')),
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_subscription_id TEXT UNIQUE,
  provider_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_owner_idx
  ON public.billing_subscriptions(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Profile creation for new Supabase Auth users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "projects_owner_all" ON public.projects;
CREATE POLICY "projects_owner_all" ON public.projects
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "assets_owner_all" ON public.assets;
CREATE POLICY "assets_owner_all" ON public.assets
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "scenes_owner_all" ON public.scenes;
CREATE POLICY "scenes_owner_all" ON public.scenes
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = owner_id)
  WITH CHECK ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "jobs_select_own" ON public.generation_jobs;
CREATE POLICY "jobs_select_own" ON public.generation_jobs
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "transactions_select_own" ON public.credit_transactions;
CREATE POLICY "transactions_select_own" ON public.credit_transactions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "exports_select_own" ON public.exports;
CREATE POLICY "exports_select_own" ON public.exports
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = owner_id);

-- Users may edit only presentation fields on their own profile. Credits and
-- plan fields can never be changed through the Data API.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles, public.generation_jobs, public.credit_transactions, public.exports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.assets, public.scenes TO authenticated;

-- Billing records are written only by the server using DATABASE_URL. No
-- Supabase client role may read or mutate them.
REVOKE ALL ON public.billing_orders, public.billing_subscriptions, public.billing_events
  FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket and owner-scoped storage policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whisk-media',
  'whisk-media',
  FALSE,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "whisk_media_select_own" ON storage.objects;
CREATE POLICY "whisk_media_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'whisk-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "whisk_media_insert_own" ON storage.objects;
CREATE POLICY "whisk_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whisk-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "whisk_media_update_own" ON storage.objects;
CREATE POLICY "whisk_media_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'whisk-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'whisk-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "whisk_media_delete_own" ON storage.objects;
CREATE POLICY "whisk_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'whisk-media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
