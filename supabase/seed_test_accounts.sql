-- 테스트 계정 시드 (비밀번호 공통: test1234)  status=active 라 바로 로그인 가능
-- 실행: schema.sql 적용 후, Supabase SQL Editor 에 붙여넣고 Run

insert into organizations (id, name, type, status) values
  ('00000000-0000-0000-0000-000000000001', '한국농어촌공사', 'client_agency', 'active'),
  ('00000000-0000-0000-0000-000000000002', '(주)테스트건설', 'contractor', 'active')
on conflict do nothing;

insert into users (id, email, password_hash, name, role, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@krc.or.kr',      '$2b$10$hXUJMViiofxrX5SHk7VEQep.mnjDQ97hRRDbg1g/I1sMXFtznJm1e', '관리자',     'admin',      'active'),
  ('00000000-0000-0000-0000-0000000000a2', 'contractor@krc.or.kr', '$2b$10$hXUJMViiofxrX5SHk7VEQep.mnjDQ97hRRDbg1g/I1sMXFtznJm1e', '시공사담당', 'contractor', 'active'),
  ('00000000-0000-0000-0000-0000000000a3', 'supervisor@krc.or.kr', '$2b$10$hXUJMViiofxrX5SHk7VEQep.mnjDQ97hRRDbg1g/I1sMXFtznJm1e', '공감소장',   'supervisor', 'active'),
  ('00000000-0000-0000-0000-0000000000a4', 'client@krc.or.kr',     '$2b$10$hXUJMViiofxrX5SHk7VEQep.mnjDQ97hRRDbg1g/I1sMXFtznJm1e', '발주청담당', 'client',     'active')
on conflict (email) do nothing;

insert into organization_members (organization_id, user_id, member_role) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'owner'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'manager')
on conflict do nothing;
