-- PartyRun rental auth schema (source of truth)
-- Project schema (no credentials in this file)
-- Roles: admin | normal
-- No self-registration — Admin creates users via Edge Function admin-register
--
-- Conflict policy:
--   - Login on another machine (device_id mismatch) → DELETE auth user
--   - Overlapping session (token mismatch while last_seen within 45s) → DELETE
-- IMPORTANT: conflict paths DELETE then RETURN jsonb (do not RAISE), so delete commits.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'normal' check (role in ('admin', 'normal')),
  is_permanent boolean not null default false,
  expires_at timestamptz null,
  device_id text null,
  session_token text null,
  last_seen_at timestamptz null,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_expires_at_idx on public.profiles (expires_at);
create index if not exists profiles_device_id_idx on public.profiles (device_id);

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
begin
  insert into public.profiles (id, role, is_permanent, email)
  values (new.id, 'normal', false, new.email)
  on conflict (id) do update set email = excluded.email;
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

create or replace function public.rental_is_valid(p public.profiles)
returns boolean language sql stable as $$
  select p.is_permanent
     or (p.expires_at is not null and p.expires_at > now());
$$;

create or replace function public.hard_delete_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.hard_delete_user(uuid) from public;
grant execute on function public.hard_delete_user(uuid) to service_role;

create or replace function public.claim_session(p_device_id text, p_session_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_device_id is null or length(trim(p_device_id)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_device_id');
  end if;
  if p_session_token is null or length(trim(p_session_token)) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session_token');
  end if;

  select * into p from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'profile_missing');
  end if;

  if p.role = 'normal' and not public.rental_is_valid(p) then
    return jsonb_build_object('ok', false, 'reason', 'rental_expired');
  end if;

  -- Another machine while bound → DELETE user immediately
  if p.device_id is not null and p.device_id <> p_device_id then
    delete from auth.users where id = uid;
    return jsonb_build_object('ok', false, 'deleted', true, 'reason', 'device_conflict_user_deleted');
  end if;

  -- Same machine (or first bind): claim / replace session token
  update public.profiles
  set device_id = p_device_id, session_token = p_session_token, last_seen_at = now()
  where id = uid;

  select * into p from public.profiles where id = uid;
  return jsonb_build_object(
    'ok', true,
    'role', p.role,
    'is_permanent', p.is_permanent,
    'expires_at', p.expires_at,
    'device_id', p_device_id
  );
end;
$$;

revoke all on function public.claim_session(text, text) from public;
grant execute on function public.claim_session(text, text) to authenticated;

create or replace function public.check_session(p_device_id text, p_session_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles%rowtype;
  active_window interval := interval '45 seconds';
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into p from public.profiles where id = uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'deleted', true, 'reason', 'profile_missing');
  end if;

  if p.role = 'normal' and not public.rental_is_valid(p) then
    return jsonb_build_object('ok', false, 'reason', 'rental_expired');
  end if;

  if p.device_id is distinct from p_device_id then
    delete from auth.users where id = uid;
    return jsonb_build_object('ok', false, 'deleted', true, 'reason', 'device_conflict_user_deleted');
  end if;

  -- Token superseded while still live → overlapping login → DELETE
  if p.session_token is distinct from p_session_token then
    if p.last_seen_at is not null and p.last_seen_at > now() - active_window then
      delete from auth.users where id = uid;
      return jsonb_build_object('ok', false, 'deleted', true, 'reason', 'concurrent_login_user_deleted');
    end if;
    return jsonb_build_object('ok', false, 'reason', 'session_superseded');
  end if;

  update public.profiles set last_seen_at = now() where id = uid;
  return jsonb_build_object(
    'ok', true,
    'role', p.role,
    'is_permanent', p.is_permanent,
    'expires_at', p.expires_at
  );
end;
$$;

revoke all on function public.check_session(text, text) from public;
grant execute on function public.check_session(text, text) to authenticated;

create or replace function public.admin_extend_rental(
  p_user_id uuid,
  p_hours int default 0,
  p_minutes int default 0,
  p_seconds int default 0,
  p_permanent boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  base_ts timestamptz;
  new_exp timestamptz;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;

  select * into p from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  if p_permanent then
    update public.profiles set is_permanent = true, expires_at = null where id = p_user_id;
  else
    base_ts := coalesce(
      case when p.expires_at is not null and p.expires_at > now() then p.expires_at else null end,
      now()
    );
    new_exp := base_ts
      + make_interval(hours => greatest(coalesce(p_hours, 0), 0))
      + make_interval(mins => greatest(coalesce(p_minutes, 0), 0))
      + make_interval(secs => greatest(coalesce(p_seconds, 0), 0));
    update public.profiles set is_permanent = false, expires_at = new_exp where id = p_user_id;
  end if;

  select * into p from public.profiles where id = p_user_id;
  return jsonb_build_object('ok', true, 'id', p.id, 'is_permanent', p.is_permanent, 'expires_at', p.expires_at);
end;
$$;

revoke all on function public.admin_extend_rental(uuid, int, int, int, boolean) from public;
grant execute on function public.admin_extend_rental(uuid, int, int, int, boolean) to authenticated;

create or replace function public.admin_list_profiles()
returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select p.* from public.profiles p
  where public.is_admin()
  order by p.created_at desc;
$$;

revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'admin_only');
  end if;
  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'cannot_delete_self');
  end if;
  delete from auth.users where id = p_user_id;
  return jsonb_build_object('ok', true, 'id', p_user_id);
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

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
