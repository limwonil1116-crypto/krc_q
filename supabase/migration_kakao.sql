-- 카카오 회원가입용: users 컬럼 조정 (Supabase SQL Editor 에 Run)
-- 카카오 사용자는 가입 전 email/비번이 없으므로 nullable 로, kakao_id 로 식별.

alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;
alter table users add column if not exists kakao_id varchar(64);
create unique index if not exists uq_users_kakao_id on users(kakao_id);
