-- RLS and privilege checks for the admin catalog migration (admin_catalog).
--
-- Run inside a transaction that is always rolled back, after the migration is applied:
--   begin; <this file>; rollback;
-- It reports one PASS/FAIL line per check. Nothing persists after the rollback.
--
-- Role switches happen outside the exception blocks: a failed block rolls back its
-- subtransaction, which would otherwise also undo `set local role`.

create temp table rls_report (n serial, line text) on commit drop;

do $$
declare
  catalog_tables text[] := array[
    'llm_providers', 'llm_models', 'prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
    'terms', 'generation_examples', 'generation_requests', 'llm_responses',
    'allowed_signup_domains', 'whitelisted_email_addresses'
  ];
  tbl text;
  report text[] := '{}';
  chain_count integer;
  character_count integer;
  step_count integer;
  mix_count integer;
  request_count integer;
  generation_count integer;
  response_count integer;
  provider_count integer;
  model_count integer;
  term_id uuid;
  before_ts timestamptz;
  after_ts timestamptz;
begin
  -- Signed-out visitors --------------------------------------------------------------
  execute 'set local role anon';

  foreach tbl in array catalog_tables loop
    begin
      execute format('select count(*) from public.%I', tbl);
      report := report || format('FAIL anon can select from %s', tbl);
    exception when insufficient_privilege then
      report := report || format('PASS anon cannot select from %s', tbl);
    end;

    begin
      execute format('insert into public.%I default values', tbl);
      report := report || format('FAIL anon can insert into %s', tbl);
    exception when insufficient_privilege then
      report := report || format('PASS anon cannot insert into %s', tbl);
    end;
  end loop;

  -- Signed-in (but non-admin) users ---------------------------------------------------
  execute 'set local role authenticated';

  foreach tbl in array catalog_tables loop
    begin
      execute format('select count(*) from public.%I', tbl);
      report := report || format('FAIL authenticated can select from %s', tbl);
    exception when insufficient_privilege then
      report := report || format('PASS authenticated cannot select from %s', tbl);
    end;

    begin
      execute format('insert into public.%I default values', tbl);
      report := report || format('FAIL authenticated can insert into %s', tbl);
    exception when insufficient_privilege then
      report := report || format('PASS authenticated cannot insert into %s', tbl);
    end;
  end loop;

  -- Back to the table owner, standing in for the service role used by the admin app.
  execute 'reset role';

  begin
    select count(*) into chain_count from public.prompt_chains;
    select count(*) into character_count from public.characters where name is not null;
    report := report || format(
      '%s prompt_chains has one row per named character (%s chains, %s characters)',
      case when chain_count = character_count then 'PASS' else 'FAIL' end,
      chain_count, character_count
    );
  exception when others then
    report := report || ('FAIL prompt_chains count: ' || sqlerrm);
  end;

  begin
    select count(*) into step_count from public.prompt_chain_steps;
    report := report || format(
      '%s prompt_chain_steps has two rows per chain (%s steps, %s chains)',
      case when step_count = 2 * chain_count then 'PASS' else 'FAIL' end,
      step_count, chain_count
    );
  exception when others then
    report := report || ('FAIL prompt_chain_steps count: ' || sqlerrm);
  end;

  begin
    select count(*) into mix_count from public.prompt_chain_mix;
    report := report || format(
      '%s prompt_chain_mix has one row per chain (%s rows, %s chains)',
      case when mix_count = chain_count then 'PASS' else 'FAIL' end,
      mix_count, chain_count
    );
  exception when others then
    report := report || ('FAIL prompt_chain_mix count: ' || sqlerrm);
  end;

  begin
    select count(*) into request_count from public.generation_requests where source = 'backfill';
    select count(*) into generation_count from public.generations;
    report := report || format(
      '%s backfilled generation_requests has one row per generation (%s requests, %s generations)',
      case when request_count = generation_count then 'PASS' else 'FAIL' end,
      request_count, generation_count
    );
  exception when others then
    report := report || ('FAIL generation_requests count: ' || sqlerrm);
  end;

  begin
    select count(*) into response_count from public.llm_responses;
    report := report || format(
      '%s llm_responses has at least two rows per backfilled request (%s responses, %s requests)',
      case when response_count >= 2 * request_count then 'PASS' else 'FAIL' end,
      response_count, request_count
    );
  exception when others then
    report := report || ('FAIL llm_responses count: ' || sqlerrm);
  end;

  begin
    select count(*) into provider_count from public.llm_providers;
    report := report || format(
      '%s at least one llm provider is seeded (%s)',
      case when provider_count >= 1 then 'PASS' else 'FAIL' end, provider_count
    );

    select count(*) into model_count from public.llm_models;
    report := report || format(
      '%s at least two llm models are seeded (%s)',
      case when model_count >= 2 then 'PASS' else 'FAIL' end, model_count
    );
  exception when others then
    report := report || ('FAIL provider/model counts: ' || sqlerrm);
  end;

  begin
    select id, updated_at into term_id, before_ts from public.terms order by term limit 1;
    update public.terms set definition = definition where id = term_id;
    select updated_at into after_ts from public.terms where id = term_id;
    report := report || format(
      '%s updating a term advances updated_at (%s -> %s)',
      case when after_ts > before_ts then 'PASS' else 'FAIL' end, before_ts, after_ts
    );
  exception when others then
    report := report || ('FAIL terms updated_at trigger: ' || sqlerrm);
  end;

  insert into rls_report (line) select unnest(report);
end;
$$;

select line from rls_report order by n;
