# VILLAIN ERA 앱 — 작업 규칙

## 배포: Netlify 무료 플랜 크레딧 아끼기
- 운영(프로덕션) 배포 1회 = 15 크레딧, 무료 플랜은 월 300 크레딧(약 20회). PR 미리보기 배포·브랜치 배포는 무료.
- `main`에 직접 push하지 않는다: 브랜치 → PR → 미리보기 배포로 확인 → 변경을 모아 `main`에 병합(운영 배포 1회).
- Netlify MCP `deploy-site`(수동 운영 배포)는 쓰지 않는다. 운영 배포는 `main` 병합으로만 한다.
- 문서(`docs/`, `README.md`, `CLAUDE.md`)와 `supabase/`만 바뀐 커밋은 `netlify.toml`의 `ignore` 규칙으로 빌드를 건너뛴다.
- 2026-10-08에 팀 크레딧이 소진됐었다. 결제 주기(팀 생성일 10-04 기준 매달 초)에 다시 채워지므로, 운영 배포 전에 Netlify 팀 › Billing에서 남은 크레딧을 확인하고 배포는 묶어서 최소로 한다.

## 공개 저장소 (2026-10-08 전환)
- GitHub 저장소는 **공개**다. Netlify 무료 플랜은 비공개 저장소에서 팀원 외 기여자(커밋의 `Co-Authored-By` 줄 포함)가 있는 커밋의 빌드를 막기 때문에 공개로 바꿨다.
- 비밀값(Supabase secret 키, 토큰, 비밀번호, 관리자 코드)은 절대 커밋하지 않는다. `.env.local`은 git에서 제외되어 있고, 서버 비밀값은 Supabase Vault에만 둔다.

## 건드리지 않는 것
- Netlify `project-villain-era`(기능 검증용 웹), `~/Desktop/deploy` 폴더, Supabase 프로젝트 `VILLAIN ERA`(뭄바이).

## 연결된 서비스
- Supabase `villain-era-app` (ref `pmbalwxxxpgjjdwuvmjv`, 서울) — 스키마 변경은 `supabase/migrations`에 파일을 추가하고 같은 SQL을 적용한다.
- Netlify `villain-era-app` (site id `1914de5a-0b9d-481b-89ab-f9c0ba2a965a`) — GitHub `eidesis8504/villain-era-app` 연결됨.

## 확인
- `npm test`(혈통·할 일·급여·건강·번식·측정 규칙 등), `npm run build`(타입 검사 + 빌드).
- DB 검사: `supabase/tests/*.sql`을 Supabase MCP `execute_sql`로 통째로 실행한다. 모든 파일은 `begin; … rollback;`이라 흔적이 남지 않고,
  `request.jwt.claims` + `set local role authenticated`로 사용자를 흉내 낸다. `profiles.is_test = true`인 고정 시험 계정 4개를 쓴다(지우지 않는다).
- 게스트 계정은 환영 화면의 '시작하기'를 눌러야 만들어진다(봇은 방문 집계에서도 빠짐).
  E2E 테스트는 일반 User-Agent와 `--disable-blink-features=AutomationControlled`로 실행하고, 만든 계정은 앱의 '계정과 기록 삭제'로 지운다.
  세션을 잃은 계정은 기록해 둔 ID로만 `delete from auth.users` 한다(Storage 파일은 SQL로 못 지움 — 먼저 앱/대시보드로).
- `src/lib/database.types.ts`는 손으로 줄인 형식이다. 새 테이블·함수는 같은 형식으로 추가한다(전체 재생성으로 덮어쓰지 않는다).
- 마이그레이션은 추가형만: 운영 DB 하나를 미리보기·운영 화면이 함께 쓴다. 같은 DB의 `public.waguwagu_test_applications`(와구와구 랜딩)는 건드리지 않는다.

## 스토어 앱 (Capacitor)
- `android/`, `ios/`는 Capacitor 프로젝트. 웹 변경 후 `npm run build && npx cap sync`.
- `android/`·`ios/`·`assets/`·`scripts/`·`capacitor.config.ts`만 바뀐 커밋은 Netlify 빌드를 건너뛴다(`netlify.toml` ignore).
- 업로드 키·서명 비밀번호는 저장소에 넣지 않는다.
