-- STEP 3: construction_sites 에 공감소장 정보 컬럼 추가
-- Supabase SQL Editor 에 붙여넣고 Run

alter table construction_sites
  add column if not exists supervisor_name  varchar(80),
  add column if not exists supervisor_phone varchar(30),
  add column if not exists supervisor_email varchar(255);
