-- Shared database: signup never grants admin rights. Existing SELECT is own-row RLS.
alter table public.profiles add column is_superadmin boolean not null default false;
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_path, house) on public.profiles to authenticated;
comment on column public.profiles.is_superadmin is 'Set only by a trusted database operator; never from signup metadata.';
