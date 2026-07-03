-- [검측 위치] construction_records 에 위치(위도/경도/주소) 컬럼 추가
alter table construction_records
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_address text;
