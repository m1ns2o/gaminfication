# 보드런 BoardRun realtime architecture

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
| 현재 턴, 라운드, 말 위치, 점수, 퀴즈·카드 상태 | GameRoom | 매 명령 DO SQLite 체크포인트 |
| 퀴즈 정답과 카드 정의 | GameRoom 비공개 콘텐츠 | 방 생성 시 D1에서 복사, DO SQLite 보관 |
| 전원 동시 문제의 제출 답안 | GameRoom 비공개 응답 버퍼 | 문제 해결 또는 시간 초과까지 DO SQLite 보관 |
| 최종 순위와 문항별 응답 | D1 | 게임 종료 후 장기 보관 |
| 열린 WebSocket | Cloudflare runtime | Hibernation 유지 |
| 연결별 participant ID | WebSocket attachment | 연결 수명 |
| 최근 action ID | GameRoom SQLite | 최근 128개 |

## Protocol

Client commands:

```ts
{ type: "SYNC" }
{ type: "START_GAME", actionId, expectedVersion }
{ type: "ROLL_DICE", actionId, expectedVersion }
{ type: "ANSWER_QUESTION", actionId, answer, expectedVersion }
{ type: "END_GAME", actionId, expectedVersion }
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
- 출제 중인 `ROOM_STATE`에는 정답을 넣지 않고 Durable Object가 비공개 정답으로 채점합니다.
- 전원 동시 문제는 제출 완료 참가자 ID만 broadcast하고 답안 값은 비공개 응답 버퍼에 둡니다.
- 문제 마감 시각을 절대 시각으로 저장하고 Durable Object Alarm이 휴면 상태에서도 시간초과를 처리합니다.
- 게임 종료 시 최종 상태, 팀/참가자별 순위·점수와 문항별 제출·정오·응답시간을 D1에 저장합니다.
- 익명 방 참가 요청은 발신자 fingerprint 기준 분당 30회로 제한하며 원본 IP는 저장하지 않습니다.
- 연결 종료 시 다른 탭 연결이 없는 참가자만 offline으로 표시합니다.
- 재접속은 같은 티켓으로 지수형 backoff를 사용하며 접속 직후 전체 snapshot을 받습니다.

## Educational game rules

구현된 흐름:

1. 교사가 편집한 24개 칸 구성에 따라 객관식·주관식·O/X 문제를 순환 출제
2. 문제별로 현재 차례 풀이 또는 접속자 전원 동시 풀이를 선택하고 서버에서 정답과 배점을 검증
3. 개인전 또는 2–8개 팀전을 선택하고 팀 점수·팀 승자를 서버에서 계산
4. 보너스·이벤트 칸에서 이동, 점수, 추가 턴, 쉬기 카드 적용
5. 토지 구매·소유권·통행료는 교육 목표에 맞지 않아 제외
6. 목표 점수·최대 라운드·직선형 완주 또는 진행자 종료로 게임 마감

운영 배포 전에는 실제 인증 공급자 연결, 오래된 방·rate-limit bucket 정리, 40명 동시 접속 부하 검증이 추가로 필요합니다.
