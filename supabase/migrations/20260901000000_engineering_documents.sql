-- Engineering Knowledge Base (MVP-10A): workspace-isolated document storage,
-- chunked/embedded content, and a hybrid (full-text + vector) search
-- function. This is retrieval infrastructure only — no agent, no LLM call
-- lives here (see CLAUDE.md: MVP-10B is the Investigation Agent).

create extension if not exists vector;

-- engineering_documents ----------------------------------------------------

create table public.engineering_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id() references public.workspaces (id) on delete cascade,
  product_id uuid,
  product_revision_id uuid,
  filename text not null,
  document_type text not null check (document_type in (
    'schematic', 'pcb', 'test_report', 'datasheet', 'regulatory',
    'mechanical', 'engineering_note', 'other'
  )),
  -- How this document entered the workspace. 'user_upload' covers the MVP
  -- happy path; 'external_reference' is reserved for a future ticket that
  -- imports a standard/regulation from outside the workspace (e.g. a
  -- shared FCC Part 15 text) without re-uploading it per workspace.
  source text not null default 'user_upload' check (source in ('user_upload', 'external_reference')),
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'indexed', 'failed')),
  storage_path text not null unique,
  mime_type text not null,
  byte_size bigint not null,
  page_count integer,
  -- Set only on a genuine failure — never a raw stack trace or parser
  -- internals, matching sanitizeAnalysisError's convention. Also the place
  -- a PDF with no extractable text is recorded ("requires later
  -- processing"), rather than silently marked indexed with zero chunks.
  failure_reason text,
  -- Versioning: a re-upload can supersede an earlier document. Superseding
  -- is an explicit application action (no trigger), so "current" always
  -- reflects a deliberate choice, not a guess.
  is_current boolean not null default true,
  supersedes_document_id uuid,
  uploaded_at timestamptz not null default now(),
  indexed_at timestamptz,
  unique (id, workspace_id),
  foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete set null,
  foreign key (product_revision_id, workspace_id)
    references public.product_revisions (id, workspace_id) on delete set null,
  foreign key (supersedes_document_id, workspace_id)
    references public.engineering_documents (id, workspace_id) on delete set null
);

alter table public.engineering_documents enable row level security;

create policy "engineering_documents_workspace_isolation" on public.engineering_documents
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger engineering_documents_set_workspace_id
  before insert on public.engineering_documents
  for each row execute function public.set_workspace_id();

create index engineering_documents_workspace_created_idx
  on public.engineering_documents (workspace_id, uploaded_at desc);

-- document_chunks ------------------------------------------------------------
-- Every chunk keeps enough provenance to cite back to an exact location:
-- documentId (via FK -> filename/type on join), page where the source
-- format has pages (PDF), section where the source has headings
-- (Markdown), and chunk_index for stable ordering either way. embedding is
-- a 512-dim vector computed by a zero-dependency local hashing embedder
-- (src/lib/documents/embedding.ts) — see that file's header comment for
-- why, and the upgrade path to a real neural embedding provider.

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null default public.current_workspace_id(),
  document_id uuid not null,
  chunk_index integer not null,
  page_number integer,
  section text,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  embedding vector(512) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  foreign key (document_id, workspace_id)
    references public.engineering_documents (id, workspace_id) on delete cascade
);

alter table public.document_chunks enable row level security;

create policy "document_chunks_workspace_isolation" on public.document_chunks
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create trigger document_chunks_set_workspace_id
  before insert on public.document_chunks
  for each row execute function public.set_workspace_id();

create index document_chunks_content_tsv_idx on public.document_chunks using gin (content_tsv);
-- HNSW builds incrementally (unlike ivfflat, which wants data present at
-- creation time) — appropriate for a table that starts empty and grows
-- with every upload.
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding vector_cosine_ops);
create index document_chunks_document_idx on public.document_chunks (document_id);

-- search_document_chunks -----------------------------------------------------
-- Hybrid retrieval in one query, ranked server-side so a caller never has
-- to load every chunk into memory to re-rank in application code (see
-- src/lib/documents/search.ts). security invoker (the default) so the
-- caller's own RLS still applies; current_workspace_id() is also read
-- directly inside the function body rather than trusting a caller-supplied
-- workspace argument at all — defense in depth against ever searching
-- another workspace's chunks.
create or replace function public.search_document_chunks(
  query_text text,
  query_embedding vector(512),
  filter_product_id uuid default null,
  filter_product_revision_id uuid default null,
  match_limit integer default 10
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  document_type text,
  page_number integer,
  section text,
  content text,
  keyword_score real,
  semantic_score real,
  combined_score real
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.filename,
    d.document_type,
    c.page_number,
    c.section,
    c.content,
    ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text))::real as keyword_score,
    (1 - (c.embedding <=> query_embedding))::real as semantic_score,
    (
      0.5 * ts_rank_cd(c.content_tsv, websearch_to_tsquery('english', query_text))
      + 0.5 * greatest(0, 1 - (c.embedding <=> query_embedding))
    )::real as combined_score
  from public.document_chunks c
  join public.engineering_documents d
    on d.id = c.document_id and d.workspace_id = c.workspace_id
  where c.workspace_id = public.current_workspace_id()
    and d.status = 'indexed'
    and (filter_product_id is null or d.product_id = filter_product_id)
    and (filter_product_revision_id is null or d.product_revision_id = filter_product_revision_id)
  order by combined_score desc
  limit greatest(match_limit, 0)
$$;

-- Private storage for uploaded documents -------------------------------------
-- Path convention: {workspaceId}/{documentId}/{filename} — RLS below keys
-- off the first path segment, so a workspace can only reach its own
-- prefix. Never public; every access goes through the RLS-checked
-- Supabase Storage API (or a short-lived signed URL), never a public URL.

insert into storage.buckets (id, name, public)
values ('engineering-documents', 'engineering-documents', false)
on conflict (id) do nothing;

create policy "engineering_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'engineering-documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "engineering_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'engineering-documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "engineering_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'engineering-documents'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );
