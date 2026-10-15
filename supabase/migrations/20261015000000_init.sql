-- AccessVault schema
-- Encrypted secrets stay ciphertext. Plaintext codes, passphrases, and keys are not columns.
-- Row Level Security isolates every table to auth.uid().

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_user_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_location_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.clients
    where id = new.client_id and user_id = new.user_id
  ) then
    raise exception 'location does not belong to this account';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_access_owner()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.clients
    where id = new.client_id and user_id = new.user_id
  ) then
    raise exception 'access record does not belong to this account';
  end if;
  if new.location_id is not null and not exists (
    select 1 from public.locations
    where id = new.location_id and user_id = new.user_id and client_id = new.client_id
  ) then
    raise exception 'location does not belong to this client';
  end if;
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  inactivity_lock_minutes integer not null default 5 check (inactivity_lock_minutes between 1 and 240),
  secret_search_opt_in boolean not null default false,
  recovery_acknowledged boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  kdf text not null check (kdf in ('argon2id', 'pbkdf2-sha256')),
  kdf_salt text not null,
  kdf_params jsonb not null,
  wrapped_dek text not null,
  wrapped_dek_nonce text not null,
  recovery_wrapped_dek text not null,
  recovery_wrapped_dek_nonce text not null,
  verifier_ciphertext text not null,
  verifier_nonce text not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  business_name text not null default '',
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes_ciphertext text,
  notes_nonce text,
  tags text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version >= 1),
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_request_id uuid not null,
  unique (user_id, client_request_id)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  address text not null default '',
  notes_ciphertext text,
  notes_nonce text,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_request_id uuid not null,
  unique (user_id, client_request_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  client_request_id uuid not null,
  unique (user_id, client_request_id)
);

create unique index categories_user_name_lower_idx on public.categories (user_id, lower(name));

create table public.access_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  title text not null check (char_length(btrim(title)) > 0),
  category text not null check (char_length(btrim(category)) > 0),
  secret_ciphertext text not null check (char_length(secret_ciphertext) > 0),
  secret_nonce text not null check (char_length(secret_nonce) > 0),
  instructions_ciphertext text,
  instructions_nonce text,
  notes_ciphertext text,
  notes_nonce text,
  expires_at date,
  status text not null default 'active' check (status in ('active', 'archived')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_request_id uuid not null,
  unique (user_id, client_request_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null check (action in (
    'login', 'logout', 'unlock', 'lock', 'reveal', 'copy', 'create', 'update',
    'archive', 'restore', 'delete', 'encrypted_backup', 'plaintext_export', 'backup_restore'
  )),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clients_user_status_name_idx on public.clients (user_id, status, name);
create index clients_user_updated_idx on public.clients (user_id, updated_at desc);
create index clients_user_accessed_idx on public.clients (user_id, last_accessed_at desc);
create index locations_user_client_idx on public.locations (user_id, client_id);
create index access_records_user_client_idx on public.access_records (user_id, client_id);
create index access_records_user_category_idx on public.access_records (user_id, category);
create index access_records_user_expires_idx on public.access_records (user_id, expires_at);
create index audit_events_user_created_idx on public.audit_events (user_id, created_at desc);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger vaults_updated_at before update on public.vaults
  for each row execute function public.set_updated_at();
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
create trigger access_records_updated_at before update on public.access_records
  for each row execute function public.set_updated_at();

create trigger clients_user_id_immutable before update on public.clients
  for each row execute function public.prevent_user_id_change();
create trigger locations_user_id_immutable before update on public.locations
  for each row execute function public.prevent_user_id_change();
create trigger access_records_user_id_immutable before update on public.access_records
  for each row execute function public.prevent_user_id_change();
create trigger categories_user_id_immutable before update on public.categories
  for each row execute function public.prevent_user_id_change();
create trigger vaults_user_id_immutable before update on public.vaults
  for each row execute function public.prevent_user_id_change();

create trigger locations_owner before insert or update on public.locations
  for each row execute function public.enforce_location_owner();
create trigger access_records_owner before insert or update on public.access_records
  for each row execute function public.enforce_access_owner();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.delete_own_vault()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.access_records where user_id = auth.uid();
  delete from public.locations where user_id = auth.uid();
  delete from public.clients where user_id = auth.uid();
  delete from public.categories where user_id = auth.uid();
  delete from public.audit_events where user_id = auth.uid();
  delete from public.vaults where user_id = auth.uid();
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.access_records where user_id = uid;
  delete from public.locations where user_id = uid;
  delete from public.clients where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.audit_events where user_id = uid;
  delete from public.vaults where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

alter table public.profiles enable row level security;
alter table public.vaults enable row level security;
alter table public.clients enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.access_records enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles
  for delete to authenticated using (id = auth.uid());

create policy vaults_select on public.vaults
  for select to authenticated using (user_id = auth.uid());
create policy vaults_insert on public.vaults
  for insert to authenticated with check (user_id = auth.uid());
create policy vaults_update on public.vaults
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vaults_delete on public.vaults
  for delete to authenticated using (user_id = auth.uid());

create policy clients_select on public.clients
  for select to authenticated using (user_id = auth.uid());
create policy clients_insert on public.clients
  for insert to authenticated with check (user_id = auth.uid());
create policy clients_update on public.clients
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy clients_delete on public.clients
  for delete to authenticated using (user_id = auth.uid());

create policy locations_select on public.locations
  for select to authenticated using (user_id = auth.uid());
create policy locations_insert on public.locations
  for insert to authenticated with check (user_id = auth.uid());
create policy locations_update on public.locations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy locations_delete on public.locations
  for delete to authenticated using (user_id = auth.uid());

create policy categories_select on public.categories
  for select to authenticated using (user_id = auth.uid());
create policy categories_insert on public.categories
  for insert to authenticated with check (user_id = auth.uid());
create policy categories_update on public.categories
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy categories_delete on public.categories
  for delete to authenticated using (user_id = auth.uid());

create policy access_records_select on public.access_records
  for select to authenticated using (user_id = auth.uid());
create policy access_records_insert on public.access_records
  for insert to authenticated with check (user_id = auth.uid());
create policy access_records_update on public.access_records
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy access_records_delete on public.access_records
  for delete to authenticated using (user_id = auth.uid());

create policy audit_events_select on public.audit_events
  for select to authenticated using (user_id = auth.uid());
create policy audit_events_insert on public.audit_events
  for insert to authenticated with check (user_id = auth.uid());
create policy audit_events_delete on public.audit_events
  for delete to authenticated using (user_id = auth.uid());

revoke all on table public.profiles from anon, public;
revoke all on table public.vaults from anon, public;
revoke all on table public.clients from anon, public;
revoke all on table public.locations from anon, public;
revoke all on table public.categories from anon, public;
revoke all on table public.access_records from anon, public;
revoke all on table public.audit_events from anon, public;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.vaults to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.access_records to authenticated;
grant select, insert, delete on public.audit_events to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.delete_own_account() from public, anon;
revoke all on function public.delete_own_vault() from public, anon;
grant execute on function public.delete_own_vault() to authenticated;
grant execute on function public.delete_own_account() to authenticated;
