# 배포 체크리스트 (Vercel)

## 1. GitHub 푸시
PowerShell (프로젝트 루트에서):
  git init
  git add .
  git commit -m "init: krc_q"
  git branch -M main
  git remote add origin https://github.com/limwonil1116-crypto/krc_q.git
  git push -u origin main

(이미 remote가 있으면 'git remote add' 는 건너뛰기)

## 2. Vercel 연결
- vercel.com 로그인(GitHub 계정) -> Add New -> Project -> krc_q import
- Framework: Next.js (자동)
- Environment Variables 에 .env.local 값 전부 등록 (.env.example 참고)
  - AUTH_URL 은 배포 후 나온 도메인으로 (예: https://krc-q.vercel.app)
- Deploy

## 3. 배포 후
- 나온 도메인 (예: https://krc-q.vercel.app) 확인
- 카카오 개발자 콘솔:
  - 플랫폼 > Web > 사이트 도메인: 배포 도메인 추가
  - 카카오 로그인 > Redirect URI: https://<도메인>/api/auth/callback/kakao 추가
  - 카카오맵 사용 ON (+ 비즈니스 정보 심사)
- Google OAuth (Drive) 콘솔:
  - 승인된 자바스크립트 원본 / 리디렉션에 배포 도메인 추가(필요시)

## 주의
- .env.local 은 절대 커밋되면 안 됨 (.gitignore 로 제외됨)
- Vercel 요청 4.5MB 제한 -> 큰 영상 업로드는 추후 직접업로드 방식 필요
