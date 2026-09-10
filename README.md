# 보드런 BoardRun

교사가 게임을 만들고 학생이 6자리 코드로 참여하는 실시간 수업용 보드게임입니다. React 19 기반 UI를 vinext로 빌드하고 Cloudflare Workers, Durable Objects, D1에서 실행합니다.

## Runtime architecture

```text
Browser
  ├─ HTTP → vinext App Router API → D1
  └─ WebSocket → Worker → one GameRoom Durable Object per room
                              ├─ authoritative turn state
                              ├─ Hibernation WebSockets
                              └─ SQLite-backed checkpoints
```

- D1은 게임 정의, 참가자와 방 메타데이터처럼 검색·보존할 데이터를 담당합니다.
- `GameRoom` Durable Object는 진행 중인 방의 턴, 말 위치, 주사위, 개인·팀 점수, 퀴즈 제한시간·채점, 카드 효과와 연결 상태를 담당합니다.
- 클라이언트는 행동 의도만 보내며 주사위와 이동 결과는 서버가 결정합니다.
- WebSocket 티켓은 D1이 아닌 방 객체 저장소에 6시간 동안 보관합니다.
- 게임 시작 시에만 D1 방 상태를 갱신하고, 매 게임 명령은 Durable Object SQLite에 체크포인트합니다.

상세한 상태 흐름과 프로토콜은 [`docs/realtime-architecture.md`](docs/realtime-architecture.md)를 참고하세요.

## Prerequisites

- Node.js `>=22.13.0`
- npm

## Local development

```bash
npm install
npm run db:migrate:local
npm run dev
```

개발 서버는 기본적으로 `http://localhost:3000`에서 시작합니다. 로컬 D1과 Durable Object 상태는 `.wrangler/` 아래에 저장되며 Git에서 제외됩니다.

### Google OAuth

Google Cloud Console에서 **웹 애플리케이션** OAuth 클라이언트를 만들고 승인된 리디렉션 URI에 다음 주소를 등록합니다.

- 로컬: `http://localhost:3000/api/v1/auth/google/callback`
- 운영: `https://boardrun.boardrun.workers.dev/api/v1/auth/google/callback`

로컬에서는 `.dev.vars.example`을 `.dev.vars`로 복사해 실제 값을 입력합니다. 운영 비밀키는 소스나 `wrangler.jsonc`에 넣지 않고 다음 명령으로 등록합니다.

```bash
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npm run db:migrate:remote
```

로그인은 Authorization Code + PKCE와 일회용 `state` 쿠키를 사용합니다. Google 액세스 토큰은 사용자 정보를 확인하는 요청에만 사용하고 데이터베이스에는 저장하지 않습니다.

`wrangler.jsonc`는 현재 Cloudflare 계정의 `site-creator-d1`에 연결되어 있습니다. 다른 계정으로 옮길 때는 `npx wrangler d1 list`로 대상 UUID를 확인해 `database_id`를 교체한 뒤 원격 마이그레이션을 적용합니다.

## Commands

- `npm run dev`: vinext/Workers 로컬 개발 서버
- `npm run build`: 프로덕션 Worker 빌드
- `npm run lint`: React와 TypeScript ESLint 검사
- `npm run test:unit`: 게임 규칙과 프로젝트 구조 테스트
- `npm run test:realtime`: 실행 중인 로컬 서버에 진행자·참가자를 연결하는 WebSocket 통합 테스트
- `npm run test:realtime:local`: 로컬 D1에 1시간짜리 테스트 교사 세션을 준비한 뒤 WebSocket 통합 테스트 실행
- `npm test`: 빌드 후 전체 비네트워크 테스트
- `npm run db:generate`: Drizzle 마이그레이션 생성
- `npm run db:migrate:local`: 로컬 D1 마이그레이션 적용
- `npm run db:migrate:remote`: 운영 D1에 새 OAuth 계정 연결 테이블을 적용

실시간 로컬 통합 테스트는 먼저 `npm run dev`를 실행한 상태에서 별도 터미널에서 `npm run test:realtime:local`로 실행합니다. 테스트 실행기는 `localhost`만 허용하며 운영 인증을 우회하는 API를 만들지 않습니다. 배포 환경을 검사할 때는 로그인한 브라우저의 세션 토큰을 `BOARDRUN_TEST_SESSION_TOKEN`에 명시적으로 전달한 뒤 `npm run test:realtime`을 사용합니다.

## Realtime implementation

- `worker/game-room.ts`: Durable Object, 티켓 검증, Hibernation WebSocket, broadcast
- `shared/game-room.ts`: 서버 권위형 방 상태와 순수 게임 규칙
- `app/lib/use-game-room.ts`: 브라우저 WebSocket 연결, heartbeat와 지수형 재접속
- `app/lib/game-room-server.ts`: App Router API에서 Durable Object를 호출하는 내부 어댑터
- `app/api/v1/rooms`: 방 생성과 진행자 세션 발급
- `app/api/v1/rooms/join`: 코드·팀 구성 조회, 참가 요청 rate limit, 참가자 등록과 세션 발급
- `app/api/v1/games/:id/questions`: 객관식·주관식·O/X 문제 CRUD
- `app/api/v1/games/:id/cards`: 이동·점수·추가 턴·쉬기 카드 CRUD
- `app/api/v1/games/:id`: 기본 설정, 종료 규칙과 24개 칸 구성 저장
- `app/api/v1/rooms/:id/results`: 종료된 수업의 팀/개인 순위와 문항별 제출·정오·응답시간 조회
- `worker/index.ts`: `/ws/rooms/:roomId` Upgrade 요청 라우팅

교육용 규칙은 방 생성, 개인전·팀전 참가, 시작, 서버 주사위, 교사가 구성한 24개 칸, 현재 차례/전원 동시 퀴즈, 제한시간·서버 채점, 팀/개인 점수와 카드 효과를 구현합니다. 보드는 중앙 무대를 도는 순환형 한 종류이며, 목표 점수·라운드 종료를 지원합니다. 주사위 3D 회전, 칸별 말 이동과 도착 피드백은 서버가 확정한 상태를 순서대로 표현합니다. 종료 결과와 문항별 응답은 D1에 저장되고 같은 탭을 새로고침해도 방 세션을 복원합니다. 땅 구매와 통행료는 의도적으로 포함하지 않습니다.
