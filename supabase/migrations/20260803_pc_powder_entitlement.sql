-- PC Powder entitlement columns (profiles.powder_is_permanent / powder_expires_at)
-- Admin extend/revoke/permanent for Powder uses RPC: admin_extend_rental_product(p_username, p_product, ...)
-- See supabase/schema.sql for full function definition and admin_lookup_user powder fields.

alter table public.profiles
  add column if not exists powder_is_permanent boolean not null default false,
  add column if not exists powder_expires_at timestamptz null;

create index if not exists profiles_powder_expires_at_idx
  on public.profiles (powder_expires_at)
  where powder_expires_at is not null;
