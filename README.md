# Classloop

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
- `GameRoom` Durable Object는 진행 중인 방의 턴, 말 위치, 주사위, 퀴즈 채점, 카드 효과와 연결 상태를 담당합니다.
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

`wrangler.jsonc`의 D1 `database_id`는 로컬 개발용 placeholder입니다. 실제 Cloudflare 계정에 직접 배포할 때는 생성한 D1 데이터베이스 ID로 교체해야 합니다.

## Commands

- `npm run dev`: vinext/Workers 로컬 개발 서버
- `npm run build`: 프로덕션 Worker 빌드
- `npm run lint`: React와 TypeScript ESLint 검사
- `npm run test:unit`: 게임 규칙과 프로젝트 구조 테스트
- `npm run test:realtime`: 실행 중인 로컬 서버에 진행자·참가자를 연결하는 WebSocket 통합 테스트
- `npm test`: 빌드 후 전체 비네트워크 테스트
- `npm run db:generate`: Drizzle 마이그레이션 생성
- `npm run db:migrate:local`: 로컬 D1 마이그레이션 적용

## Realtime implementation

- `worker/game-room.ts`: Durable Object, 티켓 검증, Hibernation WebSocket, broadcast
- `shared/game-room.ts`: 서버 권위형 방 상태와 순수 게임 규칙
- `app/lib/use-game-room.ts`: 브라우저 WebSocket 연결, heartbeat와 지수형 재접속
- `app/lib/game-room-server.ts`: App Router API에서 Durable Object를 호출하는 내부 어댑터
- `app/api/v1/rooms`: 방 생성과 진행자 세션 발급
- `app/api/v1/rooms/join`: 코드 검증, 참가자 등록과 세션 발급
- `app/api/v1/games/:id/questions`: 객관식·주관식·O/X 문제 CRUD
- `app/api/v1/games/:id/cards`: 이동·점수·추가 턴·쉬기 카드 CRUD
- `worker/index.ts`: `/ws/rooms/:roomId` Upgrade 요청 라우팅

교육용 규칙은 방 생성, 참가, 시작, 서버 주사위, 24칸 이동, 퀴즈 출제·서버 채점, 점수와 카드 효과를 구현합니다. 땅 구매와 통행료는 의도적으로 포함하지 않습니다. 제한시간 자동 처리와 수업 결과 리포트는 후속 범위입니다.
