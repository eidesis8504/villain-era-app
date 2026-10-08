# VILLAIN ERA 앱 — 작업 규칙

## 배포: Netlify 무료 플랜 크레딧 아끼기
- 운영(프로덕션) 배포 1회 = 15 크레딧, 무료 플랜은 월 300 크레딧(약 20회). PR 미리보기 배포·브랜치 배포는 무료.
- `main`에 직접 push하지 않는다: 브랜치 → PR → 미리보기 배포로 확인 → 변경을 모아 `main`에 병합(운영 배포 1회).
- Netlify MCP `deploy-site`(수동 운영 배포)는 쓰지 않는다. 운영 배포는 `main` 병합으로만 한다.
- 문서(`docs/`, `README.md`, `CLAUDE.md`)와 `supabase/`만 바뀐 커밋은 `netlify.toml`의 `ignore` 규칙으로 빌드를 건너뛴다.
- 2026-10-08에 팀 크레딧이 소진되어 운영 배포가 다음 결제 주기(11월 초 예상)까지 멈춰 있다. 미리보기 배포는 가능.

## 공개 저장소 (2026-10-08 전환)
- GitHub 저장소는 **공개**다. Netlify 무료 플랜은 비공개 저장소에서 팀원 외 기여자(커밋의 `Co-Authored-By` 줄 포함)가 있는 커밋의 빌드를 막기 때문에 공개로 바꿨다.
- 비밀값(Supabase secret 키, 토큰, 비밀번호, 관리자 코드)은 절대 커밋하지 않는다. `.env.local`은 git에서 제외되어 있고, 서버 비밀값은 Supabase Vault에만 둔다.

## 건드리지 않는 것
- Netlify `project-villain-era`(기능 검증용 웹), `~/Desktop/deploy` 폴더, Supabase 프로젝트 `VILLAIN ERA`(뭄바이).

## 연결된 서비스
- Supabase `villain-era-app` (ref `pmbalwxxxpgjjdwuvmjv`, 서울) — 스키마 변경은 `supabase/migrations`에 파일을 추가하고 같은 SQL을 적용한다.
- Netlify `villain-era-app` (site id `1914de5a-0b9d-481b-89ab-f9c0ba2a965a`) — GitHub `eidesis8504/villain-era-app` 연결됨.

## 확인
- `npm test`(혈통·할 일 규칙), `npm run build`(타입 검사 + 빌드).
- 앱은 자동화 브라우저(navigator.webdriver)와 봇 User-Agent에는 게스트 계정을 만들지 않는다.
  E2E 테스트는 일반 User-Agent와 `--disable-blink-features=AutomationControlled`로 실행하고, 끝나면 만든 계정 ID로만 삭제한다.
