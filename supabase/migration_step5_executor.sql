-- STEP 3.6: construction_sites 에 사업시행자(executor) 컬럼 추가
alter table construction_sites add column if not exists executor varchar(50);
