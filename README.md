# VILLAIN ERA — 파충류 사육 관리 · 커뮤니티

크레스티드게코·리키에너스·테구 사육자를 위한 개체 관리 플랫폼입니다.
프로토타입(`~/Desktop/deploy`, 기능 검증용 웹)을 실제 서버 저장 구조로 다시 만든 정식 버전입니다.

- 서비스 주소: https://villain-era-app.netlify.app
- 기능 검증용 웹(별도, 이 프로젝트와 무관): https://project-villain-era.netlify.app

## 기능

| 영역 | 내용 |
|---|---|
| HOME | 최신 공지, 요약 통계, 오늘의 할 일 체크, 커뮤니티 인기글 |
| 개체 등록·관리 | 개체 ID 자동 생성(VE-XXXXXXXXXX), 종·성별·모프·해칭일·부모·대표 사진, 검색·필터, 상세 ID 카드와 활동 기록 |
| 혈통 관리 | 조부모~후손 가계도, 근친계수(Wright F) 계산, 페어링 검사(설정한 COI 기준 초과 시 차단) |
| 산란 관리 | 산란 암컷 등록, 1차·2차… 차수별 기록, 부화 시 개체 자동 등록·부모 연결, 폐사 기록, 후손 목록 |
| 체중 측정 | 성장 그래프, 직전 대비 ±g, 감소 경고, 월 평균 성장, 14일 미측정 표시 |
| 오늘의 할 일 | 요일 반복/한 번, 사전 알림(10분·30분·1일 전) — 앱이 닫혀 있어도 웹 푸시로 도착 |
| 커뮤니티 | 자유·Q&A·정보·사육일지, 사진 10장·동영상 1개, 좋아요, 댓글, Q&A 답변 채택, 내 개체 기록 첨부 |
| QR | 개체 라벨 이미지 저장·인쇄, 카메라 스캔(휴대폰 기본 카메라로 찍어도 열림) |
| 분양 이전 | 분양 코드·QR 발급 → 받는 사람 계정에 같은 ID로 체중·혈통·산란 기록 복사 |
| 운영 | 관리자 코드로 운영자 권한 → 공지 작성(전 회원 알림함·푸시 발송) |

### 로그인 없이 시작 (현재 단계)

지금은 로그인 화면이 없습니다. 앱을 처음 열면 **기기마다 게스트 계정이 자동으로 만들어지고**, 모든 기록은 서버(Supabase)에 저장됩니다.

- 같은 기기·브라우저로 다시 열면 기록이 그대로 있습니다.
- 브라우저 데이터를 지우거나 다른 기기에서 열면 새 게스트 계정으로 시작합니다.
- 구글·카카오 로그인을 추가하면 지금의 게스트 계정에 **연결**하는 방식이라 기존 기록이 유지됩니다. 자세한 방법은 [docs/운영-가이드.md](docs/운영-가이드.md)를 보세요.

## 구조

```
브라우저 (React PWA, Netlify)
  ├─ Supabase Auth ─── 익명(게스트) 계정 → 추후 Google·Kakao 연결
  ├─ Supabase DB ───── 모든 테이블 RLS: 본인 데이터만 / 커뮤니티는 회원 공개
  ├─ Supabase Storage ─ 사진·동영상 (본인 폴더에만 업로드)
  └─ Service Worker ── 웹 푸시 수신
Supabase pg_cron (1분마다)
  ├─ 알림 시각이 된 할 일 → 알림함 등록
  └─ 푸시 대기 알림이 있으면 → Edge Function push-dispatch → 브라우저 푸시
```

| 위치 | 내용 |
|---|---|
| `src/app` | 앱 골격: 기기 계정 부팅, 화면 프레임(PC 좌측 메뉴/모바일 하단 탭), 토스트·배너 |
| `src/pages` | 화면 (HOME, 개체, 체중, 혈통, 산란, QR, 커뮤니티, 설정 …) |
| `src/data` | Supabase 조회·저장 (React Query) |
| `src/lib` | 혈통 계산, 할 일 규칙, 이미지·QR·푸시 처리 |
| `supabase/migrations` | DB 스키마·보안 정책·함수 (적용 순서대로) |
| `supabase/functions/push-dispatch` | 웹 푸시 발송 함수 |
| `public/sw.js` | 서비스워커 (푸시 수신만, 오프라인 캐시 없음) |

## 개발

```bash
npm install
cp .env.example .env.local   # Supabase URL / publishable 키 입력
npm run dev                  # http://localhost:5173
npm test                     # 혈통·할 일 규칙 단위 테스트
npm run build                # 타입 검사 + 프로덕션 빌드
```

## 배포

- **프론트엔드**: GitHub `main` 브랜치에 push → Netlify가 자동 빌드·배포 (`netlify.toml`)
- **DB 변경**: `supabase/migrations`에 새 파일을 추가하고 Supabase에 적용
- **푸시 함수**: `supabase/functions/push-dispatch` 수정 후 재배포

환경변수(Netlify에 등록됨): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — 둘 다 브라우저용 공개 값이며 데이터는 RLS로 보호됩니다.
