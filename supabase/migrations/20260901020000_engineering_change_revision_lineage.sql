-- MVP-11 (engineering change + second measurement + revision comparison):
-- a new revision created in response to an engineering change must retain
-- lineage to the one it supersedes, so old evidence stays historical
-- instead of ambiguous once a product has multiple revisions. Mirrors the
-- supersedes_document_id pattern already used for engineering_documents
-- (see 20260901000000_engineering_documents.sql).
alter table public.product_revisions
  add column supersedes_revision_id uuid;

alter table public.product_revisions
  add constraint product_revisions_supersedes_revision_id_fkey
  foreign key (supersedes_revision_id, workspace_id)
  references public.product_revisions (id, workspace_id) on delete set null;

-- Structured engineering-change fields. `title`/`affected_subsystem` get
-- their own columns since the UI always renders them directly; everything
-- else (previous/new value, reason, notes) goes in `payload` jsonb,
-- matching the investigation_events.payload precedent — new fields never
-- need a migration. A default is supplied only to satisfy NOT NULL for any
-- pre-existing rows (this table has had no application writer until now);
-- dropped immediately after so every future insert must supply a real
-- title.
alter table public.engineering_changes
  add column title text not null default 'Engineering change',
  add column affected_subsystem text,
  add column payload jsonb not null default '{}'::jsonb;

alter table public.engineering_changes
  alter column title drop default;
