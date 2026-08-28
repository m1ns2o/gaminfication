# Classloop realtime architecture

## Decision

한 게임방을 하나의 SQLite-backed `GameRoom` Durable Object에 매핑합니다. D1 polling을 실시간 전송 수단으로 사용하지 않습니다.

```text
POST /api/v1/rooms
  1. D1에 room 및 host participant 생성
  2. GAME_ROOMS.getByName(roomId) 선택
  3. Durable Object 초기화 및 임의의 연결 티켓 발급

GET /ws/rooms/:roomId?ticket=...
  1. Worker가 WebSocket Upgrade 검증
  2. 같은 roomId의 Durable Object로 전달
  3. ctx.acceptWebSocket()으로 Hibernation 연결 승인
  4. 최신 ROOM_STATE 전송
```

## State ownership

| State | Owner | Persistence |
| --- | --- | --- |
| 게임 정의와 공개 정보 | D1 | 장기 |
| 방 코드, 만료시간, 참가자 기록 | D1 | 수업 수명 이상 |
| 현재 턴, 라운드, 말 위치, 마지막 주사위 | GameRoom | 매 명령 DO SQLite 체크포인트 |
| 열린 WebSocket | Cloudflare runtime | Hibernation 유지 |
| 연결별 participant ID | WebSocket attachment | 연결 수명 |
| 최근 action ID | GameRoom SQLite | 최근 128개 |

## Protocol

Client commands:

```ts
{ type: "SYNC" }
{ type: "START_GAME", actionId, expectedVersion }
{ type: "ROLL_DICE", actionId, expectedVersion }
```

Server messages:

```ts
{ type: "ROOM_STATE", state }
{ type: "ROOM_ERROR", code, message, state? }
```

- `actionId`는 재전송된 명령을 한 번만 처리하기 위한 키입니다.
- `expectedVersion`은 오래된 클라이언트가 최신 상태를 덮어쓰지 못하게 합니다.
- 서버가 상태를 저장한 뒤 broadcast하므로 클라이언트가 관찰한 상태는 복구 가능한 상태입니다.
- 브라우저의 `ping` 문자열은 `setWebSocketAutoResponse()`가 처리하여 방 객체를 깨우지 않습니다.

## Hibernation constraints

- 반드시 `ctx.acceptWebSocket(server)`를 사용합니다.
- 서버 게임 루프에 `setInterval()`을 사용하지 않습니다.
- 제한시간은 절대 시각과 Durable Object Alarm으로 모델링합니다.
- 휴면 후 메모리는 초기화되므로 방 상태를 생성자에서 DO SQLite로부터 복구합니다.
- UI 애니메이션은 클라이언트가 수행하고 서버는 의미 있는 상태 변화만 전송합니다.

## Security and recovery

- WebSocket URL에는 256-bit 임의 티켓만 포함하며 사용자 ID를 신뢰하지 않습니다.
- 티켓은 해당 Durable Object 내부에만 저장되고 6시간 후 거부됩니다.
- 서버가 주사위를 생성하고 현재 차례와 상태 버전을 검증합니다.
- 연결 종료 시 다른 탭 연결이 없는 참가자만 offline으로 표시합니다.
- 재접속은 같은 티켓으로 지수형 backoff를 사용하며 접속 직후 전체 snapshot을 받습니다.

## Next game rules

다음 기능은 `shared/game-room.ts`의 순수 상태 전이 함수와 WebSocket 명령을 함께 추가합니다.

1. 땅 구매와 소유권
2. 통행료와 파산
3. 문제 출제·정답 제출
4. 카드와 특수 칸
5. 제한시간 Alarm
6. 게임 종료와 D1 결과 저장
