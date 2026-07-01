-- [검측 가이드] 1단계: DB
-- structure_types(단계 항목)에 가이드/프롬프트 텍스트 컬럼 추가
alter table structure_types
  add column if not exists guide_text text;

-- 가이드 참고자료(참고사진 / 시방서 파일) 테이블
create table if not exists guide_assets (
  id uuid primary key default gen_random_uuid(),
  structure_type_id uuid not null references structure_types(id) on delete cascade,
  asset_kind text not null default 'reference',   -- reference: 참고사진, spec: 시방서
  file_name varchar(255) not null,
  mime_type varchar(100) not null,
  file_size_bytes bigint not null default 0,
  storage_provider text not null default 'google_drive',
  storage_file_id text,
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists guide_assets_structure_idx on guide_assets(structure_type_id);
