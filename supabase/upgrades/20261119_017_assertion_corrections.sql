-- Light Web: upgrade for a database that already has migrations 001-016.
-- Adds migration 017 (correcting and withdrawing statements, item 26b1).
-- Paste into the Supabase SQL Editor and click Run once. All-or-nothing:
-- a second run fails harmlessly ("already exists") and changes nothing.
-- No existing rows change.
begin;

-- Migration 017: correcting and withdrawing statements (backlog item 26b1).
--
-- Editors may fix a statement's wording or withdraw it, but never silently:
--   * a wording change needs a reason, written for that change (it must
--     differ from the previous correction's reason); corrected_at is set here;
--   * a withdrawal needs a reason; withdrawn_at is set here; a withdrawn
--     statement stays in the record (it is never deleted by this path), its
--     wording and withdrawal can't be changed afterwards, and it can't be
--     un-withdrawn.
-- The old and new wording and every reason are kept in audit_log (migration
-- 014), which records each update's old_row and new_row.
--
-- The claim / documented / verified status is untouched: it is still derived
-- only from documents and verifications (migration 003). Withdrawing says the
-- project no longer stands behind the statement; it does not erase evidence.
--
-- Not yet on public views: showing "Withdrawn" / "Corrected" on passport
-- pages is backlog item 26b2.

alter table public.assertions
  add column correction_reason text,
  add column corrected_at      timestamptz,
  add column withdrawal_reason text,
  add column withdrawn_at      timestamptz,
  add constraint assertions_correction_reason_not_blank
    check (correction_reason is null or length(btrim(correction_reason)) > 0),
  add constraint assertions_withdrawal_reason_not_blank
    check (withdrawal_reason is null or length(btrim(withdrawal_reason)) > 0),
  add constraint assertions_withdrawal_complete
    check ((withdrawn_at is null) = (withdrawal_reason is null)),
  add constraint assertions_correction_complete
    check ((corrected_at is null) = (correction_reason is null));

comment on column public.assertions.correction_reason is
  'Why the wording was last corrected (required with each wording change; earlier reasons are in audit_log).';
comment on column public.assertions.corrected_at is 'Set by trigger when the wording changes.';
comment on column public.assertions.withdrawal_reason is 'Why the statement was withdrawn (required to withdraw).';
comment on column public.assertions.withdrawn_at is 'Set by trigger on withdrawal. Withdrawn statements stay visible as withdrawn.';

create function public.assertions_correction_rules()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    -- New statements start uncorrected and not withdrawn.
    new.correction_reason := null;
    new.corrected_at := null;
    new.withdrawal_reason := null;
    new.withdrawn_at := null;
    return new;
  end if;

  if old.withdrawn_at is not null then
    if new.statement is distinct from old.statement
       or new.correction_reason is distinct from old.correction_reason
       or new.withdrawal_reason is distinct from old.withdrawal_reason
       or new.withdrawn_at is distinct from old.withdrawn_at then
      raise exception 'This statement was withdrawn; it can no longer be corrected or un-withdrawn.'
        using errcode = 'check_violation', hint = 'withdrawn';
    end if;
    return new;
  end if;

  -- Timestamps are set here only, never by the caller.
  new.corrected_at := old.corrected_at;
  new.withdrawn_at := old.withdrawn_at;

  if new.statement is distinct from old.statement then
    if new.correction_reason is null or length(btrim(new.correction_reason)) = 0
       or new.correction_reason is not distinct from old.correction_reason then
      raise exception 'A correction needs a reason written for this change.'
        using errcode = 'check_violation', hint = 'reason';
    end if;
    new.corrected_at := now();
  elsif new.correction_reason is distinct from old.correction_reason then
    raise exception 'A correction reason can only be given together with a wording change.'
      using errcode = 'check_violation', hint = 'reason';
  end if;

  if new.withdrawal_reason is not null then
    new.withdrawn_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.assertions_correction_rules() from public, anon, authenticated;

-- Named so it runs before assertions_derive_status (triggers fire in name order).
create trigger assertions_correction_rules
  before insert or update on public.assertions
  for each row execute function public.assertions_correction_rules();

commit;
