-- CKR WWDC / Login_j3xdr — shared schema (no credentials in this file)
-- Auth identity for users: profiles.username (+ password via Supabase Auth)
-- Internal Auth email may be synthetic: {sanitized}@users.ckr.local
-- Admin username is set to their existing auth email string
-- Roles: admin | normal
-- No self-registration — admin creates users via Edge admin-register (day rental)
-- PC entitlement: is_permanent OR (expires_at > now()); banned_at blocks access
-- Powder entitlement: powder_is_permanent OR (powder_expires_at > now()) — separate from PC
-- Web entitlement: rental_is_permanent OR (rental_expires_at > now()) — separate from PC
-- token_balance remains for legacy web topup (not PC rental focus)

-- ---------------------------------------------------------------------------
-- Base profiles (idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'normal' check (role in ('admin', 'normal')),
  is_permanent boolean not null default false,
  expires_at timestamptz null,
  banned_at timestamptz null,
  device_id text null,
  session_token text null,
  last_seen_at timestamptz null,
  email text null,
  username text null,
  display_name text null,
  token_balance integer not null default 0 check (token_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists username text,
  add column if not exists display_name text,
  add column if not exists token_balance integer not null default 0
    check (token_balance >= 0),
  add column if not exists is_permanent boolean not null default false,
  add column if not exists expires_at timestamptz null,
  add column if not exists banned_at timestamptz null,
  add column if not exists rental_expires_at timestamptz null,
  add column if not exists rental_is_permanent boolean not null default false,
  add column if not exists powder_is_permanent boolean not null default false,
  add column if not exists powder_expires_at timestamptz null;

create index if not exists profiles_powder_expires_at_idx
  on public.profiles (powder_expires_at)
  where powder_expires_at is not null;

create index if not exists profiles_expires_at_idx
  on public.profiles (expires_at)
  where expires_at is not null;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username))
  where username is not null;

create index if not exists profiles_token_balance_idx
  on public.profiles (token_balance);

create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta_username text := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  meta_display text := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
begin
  insert into public.profiles (id, role, is_permanent, email, username, display_name)
  values (
    new.id,
    'normal',
    false,
    new.email,
    meta_username,
    coalesce(meta_display, meta_username)
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(excluded.username, public.profiles.username),
    display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Token ledger + farm run jobs
-- ---------------------------------------------------------------------------
create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null default '',
  balance_after integer null,
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists token_ledger_user_id_idx
  on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;

drop policy if exists "token_ledger_select_own" on public.token_ledger;
create policy "token_ledger_select_own"
  on public.token_ledger for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.token_ledger from authenticated, anon;
grant select on public.token_ledger to authenticated;

create table if not exists public.run_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  score integer null,
  coin integer null,
  exp integer null,
  result jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null
);

create index if not exists run_jobs_user_id_idx
  on public.run_jobs (user_id, created_at desc);

alter table public.run_jobs enable row level security;

drop policy if exists "run_jobs_select_own" on public.run_jobs;
create policy "run_jobs_select_own"
  on public.run_jobs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.run_jobs from authenticated, anon;
grant select on public.run_jobs to authenticated;

-- ---------------------------------------------------------------------------
-- Username → auth email (Render service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_username_email(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_username, '')));
  jwt_role text := coalesce(auth.role(), '');
  row_rec record;
begin
  if jwt_role <> 'service_role' then
    return jsonb_build_object('ok', false, 'reason', 'service_role_only');
  end if;
  if length(q) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'username_too_short');
  end if;

  select p.id, p.email, p.username, p.role, p.token_balance, p.display_name
  into row_rec
  from public.profiles p
  where lower(coalesce(p.username, '')) = q
     or lower(coalesce(p.email, '')) = q
  order by case when lower(coalesce(p.username, '')) = q then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  if row_rec.email is null or length(trim(row_rec.email)) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'auth_email_missing');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', row_rec.id,
    'email', row_rec.email,
    'username', row_rec.username,
    'role', row_rec.role,
    'token_balance', row_rec.token_balance,
    'display_name', row_rec.display_name
  );
end;
$$;

revoke all on function public.resolve_username_email(text) from public;
grant execute on function public.resolve_username_email(text) to service_role;

-- ---------------------------------------------------------------------------
-- Token RPCs
-- ---------------------------------------------------------------------------
create or replace function public.consume_token(
  p_reason text default 'farm_run'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal integer;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select token_balance into bal
  from public.profiles
  where id = uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  if bal < 1 then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_tokens', 'token_balance', bal);
  end if;

  update public.profiles
  set token_balance = token_balance - 1
  where id = uid
  returning token_balance into bal;

  insert into public.token_ledger (user_id, delta, reason, balance_after, created_by)
  values (uid, -1, coalesce(nullif(trim(p_reason), ''), 'farm_run'), bal, uid);

  return jsonb_build_object('ok', true, 'token_balance', bal);
end;
$$;

revoke all on function public.consume_token(text) from public;
grant execute on function public.consume_token(text) to authenticated;
grant execute on function public.consume_token(text) to service_role;

create or replace function public.admin_credit_tokens(
  p_user_id uuid,
  p_amount integer,
  p_reason text default 'admin_credit'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
  caller uuid := auth.uid();
  jwt_role text := coalesce(auth.role(), '');
begin
  if p_amount is null or p_amount = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  end if;

  if jwt_role = 'service_role' then
    null;
  elsif caller is not null and public.is_admin() then
    null;
  else
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;

  update public.profiles
  set token_balance = greatest(token_balance + p_amount, 0)
  where id = p_user_id
  returning token_balance into bal;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  insert into public.token_ledger (user_id, delta, reason, balance_after, created_by)
  values (
    p_user_id,
    p_amount,
    coalesce(nullif(trim(p_reason), ''), 'admin_credit'),
    bal,
    caller
  );

  return jsonb_build_object('ok', true, 'id', p_user_id, 'token_balance', bal);
end;
$$;

revoke all on function public.admin_credit_tokens(uuid, integer, text) from public;
grant execute on function public.admin_credit_tokens(uuid, integer, text) to authenticated;
grant execute on function public.admin_credit_tokens(uuid, integer, text) to service_role;

create or replace function public.admin_lookup_user(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  row_json jsonb;
  jwt_role text := coalesce(auth.role(), '');
begin
  if jwt_role = 'service_role' then
    null;
  elsif auth.uid() is not null and public.is_admin() then
    null;
  else
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;
  if length(q) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'query_too_short');
  end if;

  select jsonb_build_object(
    'ok', true,
    'id', p.id,
    'email', p.email,
    'username', p.username,
    'display_name', p.display_name,
    'role', p.role,
    'token_balance', p.token_balance,
    'is_permanent', p.is_permanent,
    'expires_at', p.expires_at,
    'powder_is_permanent', p.powder_is_permanent,
    'powder_expires_at', p.powder_expires_at,
    'banned_at', p.banned_at,
    'created_at', p.created_at
  )
  into row_json
  from public.profiles p
  where lower(coalesce(p.username, '')) = q
     or lower(coalesce(p.email, '')) = q
     or lower(coalesce(p.display_name, '')) = q
  order by
    case when lower(coalesce(p.username, '')) = q then 0
         when lower(coalesce(p.email, '')) = q then 1
         else 2 end,
    p.created_at desc
  limit 1;

  if row_json is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return row_json;
end;
$$;

revoke all on function public.admin_lookup_user(text) from public;
grant execute on function public.admin_lookup_user(text) to authenticated;
grant execute on function public.admin_lookup_user(text) to service_role;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.profiles p
  where public.is_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

-- ---------------------------------------------------------------------------
-- Day-rental helpers (PC entitlement)
-- ---------------------------------------------------------------------------
create or replace function public.rental_is_active(
  p_is_permanent boolean,
  p_expires_at timestamptz,
  p_banned_at timestamptz default null
)
returns boolean
language sql
immutable
as $$
  select p_banned_at is null
    and (
      coalesce(p_is_permanent, false) = true
      or (p_expires_at is not null and p_expires_at > now())
    );
$$;

create or replace function public.admin_extend_rental(
  p_username text,
  p_days integer default 0,
  p_hours integer default 0,
  p_minutes integer default 0,
  p_seconds integer default 0,
  p_permanent boolean default false,
  p_revoke boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_username, '')));
  jwt_role text := coalesce(auth.role(), '');
  caller uuid := auth.uid();
  row_rec public.profiles%rowtype;
  days_i integer := greatest(coalesce(p_days, 0), 0);
  hours_i integer := greatest(coalesce(p_hours, 0), 0);
  minutes_i integer := greatest(coalesce(p_minutes, 0), 0);
  seconds_i integer := greatest(coalesce(p_seconds, 0), 0);
  delta interval;
  base_ts timestamptz;
  next_exp timestamptz;
begin
  if jwt_role = 'service_role' then
    null;
  elsif caller is not null and public.is_admin() then
    null;
  else
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;

  if length(q) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'username_too_short');
  end if;

  select * into row_rec
  from public.profiles p
  where lower(coalesce(p.username, '')) = q
     or lower(coalesce(p.email, '')) = q
  order by case when lower(coalesce(p.username, '')) = q then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  if p_revoke then
    update public.profiles
    set is_permanent = false,
        expires_at = now()
    where id = row_rec.id
    returning * into row_rec;

    return jsonb_build_object(
      'ok', true,
      'action', 'revoke',
      'id', row_rec.id,
      'username', row_rec.username,
      'is_permanent', row_rec.is_permanent,
      'expires_at', row_rec.expires_at
    );
  end if;

  if p_permanent then
    update public.profiles
    set is_permanent = true,
        expires_at = null
    where id = row_rec.id
    returning * into row_rec;

    return jsonb_build_object(
      'ok', true,
      'action', 'make_permanent',
      'id', row_rec.id,
      'username', row_rec.username,
      'is_permanent', row_rec.is_permanent,
      'expires_at', row_rec.expires_at
    );
  end if;

  if days_i = 0 and hours_i = 0 and minutes_i = 0 and seconds_i = 0 then
    return jsonb_build_object('ok', false, 'reason', 'rental_duration_required');
  end if;

  delta := make_interval(
    days => days_i,
    hours => hours_i,
    mins => minutes_i,
    secs => seconds_i
  );

  -- Active rental: extend from max(expires_at, now()); expired/unset: from now()
  if coalesce(row_rec.is_permanent, false) then
    base_ts := now();
  elsif row_rec.expires_at is not null and row_rec.expires_at > now() then
    base_ts := row_rec.expires_at;
  else
    base_ts := now();
  end if;

  next_exp := base_ts + delta;

  update public.profiles
  set is_permanent = false,
      expires_at = next_exp
  where id = row_rec.id
  returning * into row_rec;

  return jsonb_build_object(
    'ok', true,
    'action', 'extend',
    'id', row_rec.id,
    'username', row_rec.username,
    'is_permanent', row_rec.is_permanent,
    'expires_at', row_rec.expires_at,
    'added_days', days_i,
    'added_hours', hours_i,
    'added_minutes', minutes_i,
    'added_seconds', seconds_i
  );
end;
$$;

revoke all on function public.admin_extend_rental(text, integer, integer, integer, integer, boolean, boolean) from public;
grant execute on function public.admin_extend_rental(text, integer, integer, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.admin_extend_rental(text, integer, integer, integer, integer, boolean, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Product-scoped rental helpers (PC vs Powder)
-- ---------------------------------------------------------------------------
create or replace function public.admin_extend_rental_product(
  p_username text,
  p_product text default 'pc',
  p_days integer default 0,
  p_hours integer default 0,
  p_minutes integer default 0,
  p_seconds integer default 0,
  p_permanent boolean default false,
  p_revoke boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_username, '')));
  prod text := lower(trim(coalesce(p_product, 'pc')));
  jwt_role text := coalesce(auth.role(), '');
  caller uuid := auth.uid();
  row_rec public.profiles%rowtype;
  days_i integer := greatest(coalesce(p_days, 0), 0);
  hours_i integer := greatest(coalesce(p_hours, 0), 0);
  minutes_i integer := greatest(coalesce(p_minutes, 0), 0);
  seconds_i integer := greatest(coalesce(p_seconds, 0), 0);
  delta interval;
  base_ts timestamptz;
  next_exp timestamptz;
  cur_permanent boolean;
  cur_expires timestamptz;
begin
  if jwt_role = 'service_role' then
    null;
  elsif caller is not null and public.is_admin() then
    null;
  else
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;

  if length(q) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'username_too_short');
  end if;

  if prod = 'pc_powder' then
    prod := 'powder';
  end if;
  if prod not in ('pc', 'powder') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_product');
  end if;

  select * into row_rec
  from public.profiles p
  where lower(coalesce(p.username, '')) = q
     or lower(coalesce(p.email, '')) = q
  order by case when lower(coalesce(p.username, '')) = q then 0 else 1 end
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  if prod = 'powder' then
    cur_permanent := coalesce(row_rec.powder_is_permanent, false);
    cur_expires := row_rec.powder_expires_at;
  else
    cur_permanent := coalesce(row_rec.is_permanent, false);
    cur_expires := row_rec.expires_at;
  end if;

  if p_revoke then
    if prod = 'powder' then
      update public.profiles
      set powder_is_permanent = false,
          powder_expires_at = now()
      where id = row_rec.id
      returning * into row_rec;
    else
      update public.profiles
      set is_permanent = false,
          expires_at = now()
      where id = row_rec.id
      returning * into row_rec;
    end if;

    return jsonb_build_object(
      'ok', true,
      'action', 'revoke',
      'product', prod,
      'id', row_rec.id,
      'username', row_rec.username,
      'is_permanent', row_rec.is_permanent,
      'expires_at', row_rec.expires_at,
      'powder_is_permanent', row_rec.powder_is_permanent,
      'powder_expires_at', row_rec.powder_expires_at
    );
  end if;

  if p_permanent then
    if prod = 'powder' then
      update public.profiles
      set powder_is_permanent = true,
          powder_expires_at = null
      where id = row_rec.id
      returning * into row_rec;
    else
      update public.profiles
      set is_permanent = true,
          expires_at = null
      where id = row_rec.id
      returning * into row_rec;
    end if;

    return jsonb_build_object(
      'ok', true,
      'action', 'make_permanent',
      'product', prod,
      'id', row_rec.id,
      'username', row_rec.username,
      'is_permanent', row_rec.is_permanent,
      'expires_at', row_rec.expires_at,
      'powder_is_permanent', row_rec.powder_is_permanent,
      'powder_expires_at', row_rec.powder_expires_at
    );
  end if;

  if days_i = 0 and hours_i = 0 and minutes_i = 0 and seconds_i = 0 then
    return jsonb_build_object('ok', false, 'reason', 'rental_duration_required');
  end if;

  delta := make_interval(
    days => days_i,
    hours => hours_i,
    mins => minutes_i,
    secs => seconds_i
  );

  if cur_permanent then
    base_ts := now();
  elsif cur_expires is not null and cur_expires > now() then
    base_ts := cur_expires;
  else
    base_ts := now();
  end if;

  next_exp := base_ts + delta;

  if prod = 'powder' then
    update public.profiles
    set powder_is_permanent = false,
        powder_expires_at = next_exp
    where id = row_rec.id
    returning * into row_rec;
  else
    update public.profiles
    set is_permanent = false,
        expires_at = next_exp
    where id = row_rec.id
    returning * into row_rec;
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', 'extend',
    'product', prod,
    'id', row_rec.id,
    'username', row_rec.username,
    'is_permanent', row_rec.is_permanent,
    'expires_at', row_rec.expires_at,
    'powder_is_permanent', row_rec.powder_is_permanent,
    'powder_expires_at', row_rec.powder_expires_at,
    'added_days', days_i,
    'added_hours', hours_i,
    'added_minutes', minutes_i,
    'added_seconds', seconds_i
  );
end;
$$;

revoke all on function public.admin_extend_rental_product(text, text, integer, integer, integer, integer, boolean, boolean) from public;
grant execute on function public.admin_extend_rental_product(text, text, integer, integer, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.admin_extend_rental_product(text, text, integer, integer, integer, integer, boolean, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles for insert to authenticated
  with check (public.is_admin());

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
