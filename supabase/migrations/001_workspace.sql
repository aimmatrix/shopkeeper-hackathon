-- Dedicated demo-only workspace. No customer personal data belongs here.
create table if not exists public.shopkeeper_demo (
  id text primary key,
  state jsonb not null,
  version bigint not null default 0,
  check (jsonb_typeof(state) = 'object'),
  check ((state->>'version')::bigint = version)
);
alter table public.shopkeeper_demo enable row level security;
revoke all on public.shopkeeper_demo from anon, authenticated;
grant select, update on public.shopkeeper_demo to anon;
grant all on public.shopkeeper_demo to service_role;
-- Apply a project-specific policy with the hash of SHOPKEEPER_WORKSPACE_KEY.
-- The raw workspace key remains in server environment variables.
