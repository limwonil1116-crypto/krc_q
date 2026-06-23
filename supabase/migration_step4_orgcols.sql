-- STEP 3.5: organizations 에 본부/지사 컬럼 추가 (Supabase SQL Editor 에 Run)
alter table organizations
  add column if not exists headquarters varchar(50),
  add column if not exists branch        varchar(50);
