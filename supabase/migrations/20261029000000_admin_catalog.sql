-- Admin catalog: LLM providers/models, prompt chains (with their steps, mix weights,
-- and example posts), vocabulary terms, generation request/response logs, and signup
-- allowlists for the Owlery admin console.
--
-- Every table below exists only for the admin app. Row Level Security is enabled with
-- no policies, and anon/authenticated are explicitly revoked all privileges, so only
-- the service role (used by the admin app after requireAdmin()) can read or write any
-- of these rows. The public app does not read any of these tables yet.
--
-- Supabase's default privileges grant anon/authenticated every table privilege on a
-- newly created table, so each table below starts from `revoke all` before anything
-- else, the same pattern used for public.characters/owl_posts/generations.

create function public.touch_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_catalog_updated_at() from public, anon, authenticated;

-- 1. llm_providers -------------------------------------------------------------------

create table public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  website_url text check (
    website_url is null or (website_url ~ '^https://' and char_length(website_url) <= 200)
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index llm_providers_name_lower_idx on public.llm_providers (lower(name));

alter table public.llm_providers enable row level security;
revoke all on public.llm_providers from anon, authenticated;
comment on table public.llm_providers is 'Admin console only: service role access, no RLS policies.';

create trigger llm_providers_touch_updated_at
  before update on public.llm_providers
  for each row execute function public.touch_catalog_updated_at();

-- 2. llm_models ------------------------------------------------------------------------

create table public.llm_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.llm_providers (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  model_identifier text not null unique check (model_identifier ~ '^[a-z0-9][a-z0-9._:/-]{0,99}$'),
  modality text not null check (modality in ('text', 'image')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index llm_models_provider_idx on public.llm_models (provider_id);

alter table public.llm_models enable row level security;
revoke all on public.llm_models from anon, authenticated;
comment on table public.llm_models is 'Admin console only: service role access, no RLS policies.';

create trigger llm_models_touch_updated_at
  before update on public.llm_models
  for each row execute function public.touch_catalog_updated_at();

-- 3. prompt_chains ---------------------------------------------------------------------

create table public.prompt_chains (
  id uuid primary key default gen_random_uuid(),
  character_id uuid unique references public.characters (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (
    description is null or char_length(btrim(description)) between 1 and 600
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.prompt_chains enable row level security;
revoke all on public.prompt_chains from anon, authenticated;
comment on table public.prompt_chains is 'Admin console only: service role access, no RLS policies.';

-- 4. prompt_chain_steps ------------------------------------------------------------------

create table public.prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null references public.prompt_chains (id) on delete cascade,
  step_order smallint not null check (step_order between 1 and 20),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  llm_model_id uuid references public.llm_models (id) on delete set null,
  instructions text not null check (char_length(btrim(instructions)) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (prompt_chain_id, step_order)
);

create index prompt_chain_steps_llm_model_idx on public.prompt_chain_steps (llm_model_id);

alter table public.prompt_chain_steps enable row level security;
revoke all on public.prompt_chain_steps from anon, authenticated;
comment on table public.prompt_chain_steps is 'Admin console only: service role access, no RLS policies.';

-- 5. prompt_chain_mix --------------------------------------------------------------------

create table public.prompt_chain_mix (
  prompt_chain_id uuid primary key references public.prompt_chains (id) on delete cascade,
  weight smallint not null default 1 check (weight between 0 and 100),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.prompt_chain_mix enable row level security;
revoke all on public.prompt_chain_mix from anon, authenticated;
comment on table public.prompt_chain_mix is 'Admin console only: service role access, no RLS policies.';

create trigger prompt_chain_mix_touch_updated_at
  before update on public.prompt_chain_mix
  for each row execute function public.touch_catalog_updated_at();

-- 6. terms ---------------------------------------------------------------------------

create table public.terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(btrim(term)) between 1 and 80),
  definition text not null check (char_length(btrim(definition)) between 1 and 600),
  example text check (example is null or char_length(btrim(example)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index terms_term_lower_idx on public.terms (lower(term));

alter table public.terms enable row level security;
revoke all on public.terms from anon, authenticated;
comment on table public.terms is 'Admin console only: service role access, no RLS policies.';

create trigger terms_touch_updated_at
  before update on public.terms
  for each row execute function public.touch_catalog_updated_at();

-- 7. generation_examples -----------------------------------------------------------------

create table public.generation_examples (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid references public.prompt_chains (id) on delete set null,
  scene text not null check (char_length(btrim(scene)) between 1 and 400),
  twist text check (twist is null or char_length(btrim(twist)) between 1 and 140),
  caption text not null check (char_length(btrim(caption)) between 1 and 400),
  notes text check (notes is null or char_length(btrim(notes)) between 1 and 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generation_examples_prompt_chain_idx on public.generation_examples (prompt_chain_id);

alter table public.generation_examples enable row level security;
revoke all on public.generation_examples from anon, authenticated;
comment on table public.generation_examples is 'Admin console only: service role access, no RLS policies.';

create trigger generation_examples_touch_updated_at
  before update on public.generation_examples
  for each row execute function public.touch_catalog_updated_at();

-- 8. generation_requests ------------------------------------------------------------------

create table public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users (id) on delete set null,
  prompt_chain_id uuid references public.prompt_chains (id) on delete set null,
  owl_post_date date not null,
  user_twist text check (user_twist is null or char_length(user_twist) <= 140),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  error_message text check (error_message is null or char_length(error_message) <= 600),
  generation_id uuid references public.generations (id) on delete set null,
  source text not null check (source in ('public_app', 'admin_app', 'backfill')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index generation_requests_created_at_idx on public.generation_requests (created_at desc);
create index generation_requests_generation_idx on public.generation_requests (generation_id);
create index generation_requests_prompt_chain_idx on public.generation_requests (prompt_chain_id);
create index generation_requests_requested_by_idx on public.generation_requests (requested_by);

alter table public.generation_requests enable row level security;
revoke all on public.generation_requests from anon, authenticated;
comment on table public.generation_requests is 'Admin console only: service role access, no RLS policies.';

-- 9. llm_responses -----------------------------------------------------------------------

create table public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  generation_request_id uuid references public.generation_requests (id) on delete cascade,
  llm_model_id uuid references public.llm_models (id) on delete set null,
  model_identifier text not null check (char_length(model_identifier) between 1 and 100),
  step text not null check (step in ('caption', 'illustration')),
  prompt text not null,
  response_text text,
  finish_reason text check (finish_reason is null or char_length(finish_reason) <= 60),
  status text not null check (status in ('succeeded', 'failed')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index llm_responses_generation_request_idx on public.llm_responses (generation_request_id);
create index llm_responses_llm_model_idx on public.llm_responses (llm_model_id);
create index llm_responses_created_at_idx on public.llm_responses (created_at desc);

alter table public.llm_responses enable row level security;
revoke all on public.llm_responses from anon, authenticated;
comment on table public.llm_responses is 'Admin console only: service role access, no RLS policies.';

-- 10. allowed_signup_domains ---------------------------------------------------------------

create table public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (
    char_length(domain) <= 253
    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  note text check (note is null or char_length(btrim(note)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.allowed_signup_domains enable row level security;
revoke all on public.allowed_signup_domains from anon, authenticated;
comment on table public.allowed_signup_domains is 'Admin console only: service role access, no RLS policies.';

-- 11. whitelisted_email_addresses ----------------------------------------------------------

create table public.whitelisted_email_addresses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (
    email = lower(email)
    and char_length(email) <= 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  note text check (note is null or char_length(btrim(note)) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.whitelisted_email_addresses enable row level security;
revoke all on public.whitelisted_email_addresses from anon, authenticated;
comment on table public.whitelisted_email_addresses is 'Admin console only: service role access, no RLS policies.';

-- Backfill / seed ----------------------------------------------------------------------
-- Deterministic, derived from existing rows only. Every insert below succeeds on an
-- empty database too (the select/join sources simply return no rows in that case).

-- The one provider in use today.
insert into public.llm_providers (name, website_url)
values ('Google', 'https://ai.google.dev');

-- The two models already used by existing generations.
insert into public.llm_models (provider_id, name, model_identifier, modality)
select p.id, v.name, v.model_identifier, v.modality
from (
  values
    ('Gemini 3.5 Flash-Lite', 'gemini-3.5-flash-lite', 'text'),
    ('Gemini 3.1 Flash-Lite Image', 'gemini-3.1-flash-lite-image', 'image')
) as v (name, model_identifier, modality)
join public.llm_providers p on p.name = 'Google';

-- Any other distinct caption/image models seen historically but not yet cataloged above,
-- kept inactive until an admin reviews them.
insert into public.llm_models (provider_id, name, model_identifier, modality, is_active)
select p.id, g.caption_model, g.caption_model, 'text', false
from (select distinct caption_model from public.generations) g
join public.llm_providers p on p.name = 'Google'
where not exists (
  select 1 from public.llm_models m where m.model_identifier = g.caption_model
)
on conflict (model_identifier) do nothing;

insert into public.llm_models (provider_id, name, model_identifier, modality, is_active)
select p.id, g.image_model, g.image_model, 'image', false
from (select distinct image_model from public.generations) g
join public.llm_providers p on p.name = 'Google'
where not exists (
  select 1 from public.llm_models m where m.model_identifier = g.image_model
)
on conflict (model_identifier) do nothing;

-- One prompt chain per named character.
insert into public.prompt_chains (character_id, name, description, is_active)
select
  c.id,
  c.name || '''s Owl Post',
  'Writes a short campus post in ' || c.name || '''s voice about the week''s Owl Post topic, then illustrates the same moment.',
  c.is_active
from public.characters c
where c.name is not null;

-- Two steps per chain: a caption step, then an illustration step.
insert into public.prompt_chain_steps (prompt_chain_id, step_order, title, llm_model_id, instructions)
select
  pc.id,
  1,
  'Caption',
  m.id,
  'Hog Wumbia writing prompt v6. Writes as the chain''s character about this week''s Owl Post headline and campus situation, keeping the reader''s optional twist as story facts. Returns JSON with a short sassy caption and one drawable scene that shows the same event.'
from public.prompt_chains pc
join public.llm_models m on m.model_identifier = 'gemini-3.5-flash-lite';

insert into public.prompt_chain_steps (prompt_chain_id, step_order, title, llm_model_id, instructions)
select
  pc.id,
  2,
  'Illustration',
  m.id,
  'Turns the scene, caption and twist into a painterly storybook illustration styled like an enchanted vintage newspaper photograph, set in present-day New York with the supplied Columbia location. Fictional names are scrubbed; no text, logos or real people.'
from public.prompt_chains pc
join public.llm_models m on m.model_identifier = 'gemini-3.1-flash-lite-image';

-- One mix entry per chain.
insert into public.prompt_chain_mix (prompt_chain_id, weight, is_enabled)
select pc.id, 1, pc.is_active
from public.prompt_chains pc;

-- Vocabulary.
insert into public.terms (term, definition) values
  ('Owl Post', 'The weekly campus topic every post reacts to: a headline plus a specific Columbia situation.'),
  ('Twist', 'An optional detail of up to 140 characters that a reader adds to change what happens in their post.'),
  ('House points', 'A house''s net score for the current week: upvotes minus downvotes on posts published by its members.'),
  ('Writer', 'The character whose voice and appearance a post uses. Each writer has its own prompt chain.');

-- Up to 5 top-rated posts, seeded as reference examples.
insert into public.generation_examples (prompt_chain_id, scene, twist, caption, notes)
select pc.id, o.scene, g.user_twist, g.caption, 'Seeded from a top-rated post.'
from public.generations g
join public.owl_posts o on o.id = g.owl_post_id
join public.prompt_chains pc on pc.character_id = g.character_id
where g.score > 0
order by g.score desc, g.created_at desc
limit 5;

-- One generation request per existing generation (a left join keeps every generation even
-- if, hypothetically, its character has no matching chain).
insert into public.generation_requests (
  requested_by, prompt_chain_id, owl_post_date, user_twist, status, generation_id, source,
  created_at, completed_at
)
select
  g.author_id, pc.id, g.owl_post_date, g.user_twist, 'succeeded', g.id, 'backfill',
  g.created_at, g.created_at
from public.generations g
left join public.prompt_chains pc on pc.character_id = g.character_id;

-- Two LLM responses per backfilled request: the caption call, then the illustration call.
insert into public.llm_responses (
  generation_request_id, llm_model_id, model_identifier, step, prompt, response_text,
  status, created_at
)
select gr.id, m.id, g.caption_model, 'caption', g.caption_prompt, g.caption, 'succeeded', g.created_at
from public.generation_requests gr
join public.generations g on g.id = gr.generation_id
left join public.llm_models m on m.model_identifier = g.caption_model
where gr.source = 'backfill';

insert into public.llm_responses (
  generation_request_id, llm_model_id, model_identifier, step, prompt, response_text,
  status, created_at
)
select gr.id, m.id, g.image_model, 'illustration', g.image_prompt, 'Image stored at ' || g.image_path, 'succeeded', g.created_at
from public.generation_requests gr
join public.generations g on g.id = gr.generation_id
left join public.llm_models m on m.model_identifier = g.image_model
where gr.source = 'backfill';

-- Reference signup domains (not enforced at sign-in yet).
insert into public.allowed_signup_domains (domain, note) values
  ('columbia.edu', 'Reference list — not enforced at sign-in yet.'),
  ('barnard.edu', 'Reference list — not enforced at sign-in yet.');

-- whitelisted_email_addresses starts empty; no seed rows.
