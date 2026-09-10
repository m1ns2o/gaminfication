<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V5 -->

# 보드런 BoardRun 상용 보드게임 디자인 레퍼런스

조사일: 2026-08-29

## 조사 목적

보드런 BoardRun을 일반적인 교육 웹 대시보드가 아니라, 여러 기기에서 함께 플레이하는 완성도 높은 디지털 보드게임으로 개편하기 위한 레퍼런스다. 아래 자료에서는 브랜드 그래픽이나 캐릭터를 복제하지 않고 다음 원리만 추출한다.

- 게임판을 하나의 물리적 무대로 보이게 만드는 방법
- 주사위, 말 이동, 칸 도착, 카드 공개를 한 턴의 연속 연출로 만드는 방법
- 현재 차례, 플레이어 상태, 목표를 게임판을 가리지 않고 전달하는 방법
- 교사가 문제 세트를 만들고 방을 여는 흐름과 학생이 코드로 참여하는 흐름
- 브라우저에서 구현 가능한 3D, 물리, 사운드 및 상용 사용 가능 자산

## 먼저 볼 8개

전체를 다 보기 전에 아래 8개를 같은 순서로 보면 방향이 빠르게 잡힌다.

1. [모두의마블 공식 게임 가이드](https://modoo.netmarble.net/Guide/Guide.asp) — 대기실, 방 생성, 게임 화면, 맵 종류를 하나의 제품으로 묶는 방식
2. [MONOPOLY GO! 공식 갤러리](https://www.scopely.com/en/games/monopoly-go) — 주사위 버튼을 핵심 CTA로 만드는 법과 보드의 입체감
3. [Super Mario Party Jamboree](https://play.nintendo.com/explore/super-mario-party-jamboree/) — 주사위부터 칸 이벤트까지 한 턴을 쇼처럼 연출하는 법
4. [Board Kings 스토어 갤러리](https://play.google.com/store/apps/details?id=com.jellybtn.boardkings&hl=en_US) — 작은 화면에서 3D 보드 전체와 큰 주사위 CTA를 공존시키는 법
5. [THE GAME OF LIFE](https://www.marmaladegamestudio.com/games/game-of-life) — 실제 보드게임을 가족 친화적인 3D 제품으로 옮기는 법
6. [Ticket to Ride 디지털](https://www.marmaladegamestudio.com/games/ticket-to-ride) — 보드 재질, 말, 지도, HUD의 정보 계층
7. [Blooket 게임 호스팅 흐름](https://help.blooket.com/hc/en-us/articles/15984215236503-How-to-Host-a-Blooket-Game) — 문제 세트와 게임 모드를 분리하는 교사 UX
8. [Board Game Arena UX 지침 PDF](https://en.doc.boardgamearena.com/images/5/57/Guidelines_UX_new_compressed.pdf) — 실제 출시 단계에서 확인해야 할 보드게임 UX 체크리스트

## A. 캐주얼 3D 보드와 주사위 연출

### 모두의마블

- 링크: [공식 홈](https://modoo.netmarble.net/), [게임 가이드](https://modoo.netmarble.net/Guide/Guide.asp), [Google Play 갤러리](https://play.google.com/store/apps/details?id=com.cjenm.ModooMarbleKakao&hl=ko)
- 볼 것: 게임판 중앙을 비워 주요 액션을 띄우는 구조, 플레이어별 색, 모서리 칸의 랜드마크성, 턴 종료까지 이어지는 연출
- 가져올 것: 게임판 내부 CTA, 플레이어 초상과 턴 강조, 맵마다 전혀 다른 사건 규칙
- 버릴 것: 확률형 아이템, 과도한 재화 HUD, 작은 프로모션 버튼, 토지 매입 중심 문법

### MONOPOLY GO!

- 링크: [공식 게임 페이지](https://www.scopely.com/en/games/monopoly-go), [공식 보드 설명](https://monopolygo.helpshift.com/hc/en/3-monopoly-go/faq/66-board/)
- 볼 것: 낮은 시점의 디오라마 보드, 화면 하단 중앙의 주사위, 말이 이동할 경로의 선명한 깊이, 칸 도착 즉시 보상 피드백
- 가져올 것: `대기 → 주사위 준비 → 충돌 → 결과 → 칸별 이동 → 도착 이벤트`의 명확한 단계
- 버릴 것: 보드 모서리와 색상 체계의 직접 모사, 구매/건설/강탈 테마

### Board Kings

- 링크: [Google Play 공식 갤러리](https://play.google.com/store/apps/details?id=com.jellybtn.boardkings&hl=en_US)
- 볼 것: 기울어진 3D 보드를 어느 방향에서도 읽을 수 있게 만든 타일, 장난감 같은 건물, 강한 원근과 부드러운 그림자
- 가져올 것: 교육 맵을 작은 테마파크처럼 만드는 방식, 칸보다 랜드마크를 크게 보여 주는 방식
- 주의: 리뷰에서도 팝업과 화면 점유가 반복적으로 지적된다. 이벤트 버튼과 알림을 보드 가장자리에 쌓는 패턴은 피한다.

### Dice Dreams

- 링크: [Google Play 공식 갤러리](https://play.google.com/store/apps/details?id=com.superplaystudios.dicedreams&hl=en-US)
- 볼 것: 주사위를 던지는 캐릭터 반응, 충돌 파티클, 결과 숫자 확대, 보상 연쇄
- 가져올 것: 주사위 자체만 돌리는 것이 아니라 카메라, 그림자, 바닥 충돌, 사운드, 캐릭터 리액션을 함께 묶는 방식
- 버릴 것: 슬롯머신 같은 과도한 보상 연출과 재화 중심 루프

### THE GAME OF LIFE / THE GAME OF LIFE 2

- 링크: [THE GAME OF LIFE](https://www.marmaladegamestudio.com/games/game-of-life), [THE GAME OF LIFE 2 프레스킷](https://www.marmaladegamestudio.com/the-game-of-life-2-press-kit)
- 볼 것: 실제 플라스틱 보드의 광택과 두께, 회전판과 말의 물성, 밝지만 유아용으로 보이지 않는 색 구성
- 가져올 것: 보드런 BoardRun 게임판을 브라우저 UI가 아니라 실제 제품 상자에서 꺼낸 보드처럼 보이게 하는 재질감

## B. 파티게임의 턴 연출과 반응

### Super Mario Party Jamboree

- 링크: [공식 플레이 가이드](https://play.nintendo.com/explore/super-mario-party-jamboree/), [보드 갤러리](https://www.nintendo.com/en-gb/Games/Nintendo-Switch-games/Super-Mario-Party-Jamboree-2591147.html)
- 볼 것: 캐릭터가 주사위 블록을 직접 치는 준비 동작, 결과 숫자가 읽히는 정지 시간, 칸에 따라 공간 전체가 반응하는 이벤트
- 가져올 것: 다른 플레이어의 턴에도 이모지 반응을 보낼 수 있는 장치, 기다리는 시간을 관전 경험으로 바꾸는 방식
- 보드런 BoardRun 적용: 학생은 주사위를 누르고, 다른 학생은 짧은 리액션만 보낼 수 있게 한다. 퀴즈가 나오면 보드 중앙이 무대로 전환된다.

### Mario Party Superstars

- 링크: [공식 사이트](https://mariopartysuperstars.nintendo.com/)
- 볼 것: 복잡한 보드를 캐릭터와 경로 중심으로 읽게 만드는 카메라, 현재 차례 외 HUD를 낮추는 방식, 게임판과 미니게임 전환
- 가져올 것: 퀴즈를 하단 패널로 끼우지 않고 게임판을 잠시 덮는 독립 장면으로 취급하는 방식

### Exploding Kittens 2

- 링크: [공식 게임 페이지와 스크린샷](https://www.marmaladegamestudio.com/games/exploding-kittens-2)
- 볼 것: 카드가 덱에서 빠져나와 정면으로 회전하고, 그림이 애니메이션으로 살아난 뒤 효과가 보드에 적용되는 흐름
- 가져올 것: 보드런 BoardRun의 보너스/방해 카드를 `작은 토스트`가 아니라 한 장의 수집 가능한 게임 카드로 표현
- 버릴 것: 원작의 카드 프레임, 삽화, 카피 문체를 그대로 모방하는 것

### Clue / Cluedo

- 링크: [공식 디지털 게임](https://www.marmaladegamestudio.com/games/cluedo), [프레스킷](https://www.marmaladegamestudio.com/cluedo-press-kit)
- 볼 것: 보드 위 캐릭터와 별도의 사건/증거 패널이 충돌하지 않는 계층, 맵 테마가 바뀌어도 같은 규칙을 유지하는 디자인 시스템
- 가져올 것: 과목별 맵 스킨은 바뀌어도 타일 의미, 카드 프레임, 퀴즈 레이아웃은 동일한 규칙을 유지

## C. 실제 보드 재질과 정보 설계

### CATAN Universe

- 링크: [공식 게임 소개](https://www.catan.com/catan-universe), [공식 스크린샷](https://catanuniverse.com/en/media/)
- 볼 것: 육각 타일의 두께, 자원별 색과 재질, 실제 게임 말에 가까운 실루엣, 화면 크기에 따라 바뀌는 카메라
- 가져올 것: 타일 유형은 색만 다르게 하지 말고 아이콘, 표면 패턴, 가장자리, 랜드마크를 함께 다르게 한다.

### Ticket to Ride

- 링크: [공식 디지털 게임](https://www.marmaladegamestudio.com/games/ticket-to-ride), [Google Play](https://play.google.com/store/apps/details?id=com.marmalade.tickettoride)
- 볼 것: 지도는 화면 대부분을 차지하지만 플레이어 카드와 목표가 필요할 때만 전면으로 나오는 방식, 매끈한 3D 말 애니메이션
- 가져올 것: 게임판 우선, 보조 정보는 가장자리 또는 접히는 트레이에 배치

### Wingspan

- 링크: [공식 게임 페이지](https://www.monstercouch.com/game/wingspan/), [공식 프레스킷](https://monstercouch.com/press/sheet.php?p=wingspan)
- 볼 것: 종이 카드와 자연 배경을 결합하면서도 프리미엄 보드게임 인쇄물 같은 절제된 타이포그래피
- 가져올 것: 교육용이라고 무조건 원색과 큰 둥근 버튼을 쓰지 않고, 과목별 일러스트와 인쇄물 같은 카드 품질로 깊이를 만드는 방식

### Root Digital

- 링크: [Dire Wolf Digital 공식 페이지](https://www.direwolfdigital.com/root/)
- 볼 것: 손으로 그린 평면 보드와 애니메이션 캐릭터가 함께 존재하는 방식, 진영별로 완전히 다른 정보 패널
- 가져올 것: WebGL 3D가 부담스러운 기기에서는 `2.5D 일러스트 보드 + 입체 그림자 + 애니메이션 말`만으로도 상용 품질을 만들 수 있다는 근거

### Armello

- 링크: [공식 프레스킷](https://armello.com/_press/sheet.php?p=armello), [Steam 갤러리](https://store.steampowered.com/app/290340/Armello/)
- 볼 것: 보드게임 규칙을 영화적 조명, 낮/밤 변화, 주사위 전투, 카드로 확장한 방식
- 가져올 것: 학습 맵도 시간대나 단원 진행에 따라 조명과 주변 환경이 변하게 만들 수 있다.
- 주의: 보드런 BoardRun에는 지나치게 어둡고 복잡한 HUD가 맞지 않으므로 연출 강도만 참고한다.

### 추가 관찰 목록

- [Quilts and Cats of Calico 프레스킷](https://monstercouch.com/press/sheet.php?p=quilts_and_cats_of_calico) — 천이 고양이 무게에 눌리는 것처럼 재질이 플레이에 반응하는 사례. 종이와 목재뿐 아니라 천, 스티커, 점토 같은 교실 재료를 디지털로 표현할 때 유용하다.
- [Dorfromantik](https://store.steampowered.com/app/1455840/Dorfromantik/) — 육각 타일을 놓을 때 풍경이 자연스럽게 이어지는 사례. 교사가 만든 직선/순환 맵 외에 조립형 탐험 맵을 검토할 때 참고한다.
- [Everdell Digital](https://www.direwolfdigital.com/everdell/) — 카드, 자원, 작은 피규어, 계절 변화를 한 화면에 통합한 사례. 단원 진행에 따라 보드 환경이 변하는 아이디어에 적합하다.
- [Welcome to Everdell](https://www.direwolfdigital.com/welcome-to-everdell/) — 어린 사용자에게 규칙을 단순화해 보여 주면서도 장난감 같은 제품 품질을 유지하는 사례다.
- [Dune: Imperium Digital](https://www.direwolfdigital.com/dune-imperium-digital/) — 정보가 많은 전략 보드게임에서 행동 가능한 위치와 카드 선택을 강조하는 사례. 교사 관리 화면의 고급 모드에만 참고한다.
- [Tabletopia](https://tabletopia.com/about) — 브라우저에서 실제 테이블, 좌석, 카드 셔플, 턴 추적을 구현한 가상 보드게임 플랫폼. `게임판을 웹페이지가 아니라 공유 테이블로 느끼게 하는 방법`을 확인하기 좋다.
- [Tabletop Simulator 보드 가이드](https://kb.tabletopsimulator.com/custom-content/custom-board/) — 커스텀 보드와 물리 오브젝트를 분리하는 구조. 보드런 BoardRun 맵 편집기에서 바닥 아트와 규칙 타일 데이터를 분리하는 참고 사례다.

## D. 교육용 게임의 교사·학생 흐름

### Blooket

- 링크: [공식 호스팅 가이드](https://help.blooket.com/hc/en-us/articles/15984215236503-How-to-Host-a-Blooket-Game)
- 핵심 흐름: 문제 세트 선택 → 게임 모드 선택 → Host → 방 코드 공유
- 가져올 것: 퀴즈 데이터와 보드게임 규칙을 분리한다. 같은 문제 세트를 순환형, 일직선형, 팀전 등 여러 맵에서 재사용할 수 있어야 한다.

### Quizizz

- 링크: [공식 실시간 세션 모드](https://support.quizizz.com/hc/en-us/articles/360030685632-Live-Session-Modes-on-Quizizz), [세션 도움말](https://support.quizizz.com/hc/en-us/categories/16359192104473-Host-Assign-Join-Sessions)
- 볼 것: 학생 자율 속도, 교사 진행 속도, 팀전, 정확도 중심 모드를 같은 콘텐츠에서 선택하는 구조
- 가져올 것: 보드런 BoardRun도 `턴 플레이`, `모두 답하기`, `팀 협동`, `교사 진행`을 맵과 별개인 세션 옵션으로 둔다.

### Kahoot!

- 링크: [학교용 공식 페이지](https://kahoot.com/schools/), [플레이 방식](https://kahoot.com/schools/ways-to-play/)
- 볼 것: 교사용 화면과 학생용 화면의 역할이 다르며, 정답 후 즉시 결과와 다음 행동을 명확히 보여 주는 방식
- 가져올 것: 교사 화면에는 전체 진행과 응답 분포, 학생 화면에는 현재 행동 하나만 크게 표시한다.

## E. 로비와 실시간 게임 UX 기준

### Board Game Arena UX Guidelines

- 링크: [공식 UX 지침 PDF](https://en.doc.boardgamearena.com/images/5/57/Guidelines_UX_new_compressed.pdf)
- 핵심: 현재 플레이어가 필요한 정보는 정사각형에 가까운 게임 영역 안에서 보여 주고, 부가 정보는 스크롤 또는 접히는 영역으로 분리한다.
- 체크 포인트: 중앙 정렬, 보드 주변의 빈 여백, 점수/턴/목표의 접근성, 모바일에서 작은 텍스트를 확대하는 방법, 행동 결과 피드백

### Apple Game Center 파티 코드 지침

- 링크: [Apple Human Interface Guidelines — Game Center](https://developer.apple.com/design/human-interface-guidelines/game-center)
- 가져올 것: 방 코드는 읽기 쉽고 복사/공유가 즉시 가능해야 하며, 참여 상태와 초대 상태를 명확히 구분한다.
- 보드런 BoardRun 적용: 학생 로그인 없이 `6자리 코드 + 닉네임`, 교사는 QR과 링크를 동시에 제공한다.

### Game UI Database / Interface In Game

- 링크: [Game UI Database](https://gameuidatabase.com/), [Interface In Game](https://interfaceingame.com/), [Game UI 입문과 데이터베이스 활용법](https://www.sketch.com/blog/game-ui-design/)
- 활용법: 게임 이름으로만 찾지 말고 `HUD`, `Dialogue`, `Rewards`, `Pause`, `Lobby`, `Results`, `Map` 화면 유형별로 비교한다.
- 주의: 스크린샷은 분석용이다. 이미지나 UI 그래픽을 제품 자산으로 재사용하지 않는다.

## F. 브라우저 구현과 상용 사용 가능한 자산

### 실제 물리 주사위

- [3d-dice/dice-box](https://github.com/3d-dice/dice-box) — BabylonJS, AmmoJS, Web Worker, OffscreenCanvas를 이용하는 MIT 라이선스 3D 주사위
- [React Three Fiber](https://r3f.docs.pmnd.rs/tutorials/how-it-works) — React에서 Three.js 장면을 구성하는 렌더러
- [Rapier JavaScript](https://rapier.rs/docs/user_guides/templates/getting_started_js/) — 직접 주사위 물리와 충돌을 구성할 때 사용할 수 있는 2D/3D 물리 엔진
- 권장: 1차 프로토타입은 `dice-box`로 물성과 카메라를 검증하고, 제품 아트가 확정되면 커스텀 메시/재질로 교체한다.

### 2D·3D 자산

- [Kenney Assets](https://kenney.nl/assets/) — Boardgame Pack, UI Pack, Interface Sounds 등. 개별 라이선스를 확인하되 대표 번들은 CC0로 제공된다.
- [Quaternius](https://quaternius.com/) — 스타일라이즈드 3D 환경, 캐릭터, 카드 키트. [FAQ](https://quaternius.com/faq.html)에 따르면 CC0이며 상업·교육 프로젝트에서 사용 가능하다.
- [Poly Haven](https://polyhaven.com/) — 목재, 종이, 천, 환경 조명을 위한 PBR 텍스처와 HDRI. [라이선스](https://polyhaven.com/license)는 CC0다.
- 사용 원칙: 여러 라이브러리의 스타일을 섞지 않는다. 한 종류를 베이스로 삼고 색, 비율, 재질을 보드런 BoardRun 전용으로 다시 조정한다.

## 보드런 BoardRun에 가장 적합한 합성 방향

### 권장안: Classroom Adventure Table

`MONOPOLY GO의 읽기 쉬운 턴 연출 + Mario Party의 이벤트 무대 + THE GAME OF LIFE의 장난감 물성 + Wingspan의 카드 품질 + Blooket의 교사 흐름`을 결합한다.

- 게임판: 책상 위에 놓인 두꺼운 접이식 보드. 카메라는 약 35~45도 기울어진 탑다운
- 말: 학생마다 색과 실루엣이 다른 작은 나무/레진 피규어
- 타일: 퀴즈, 카드, 점프, 휴식, 보너스를 색뿐 아니라 모양과 작은 소품으로 구별
- 중앙: 평상시에는 맵의 랜드마크, 턴 시작에는 주사위 무대, 퀴즈 시에는 큰 카드 무대
- HUD: 상단에는 현재 라운드와 목표만, 플레이어 상태는 가장자리의 작은 좌석 카드
- 퀴즈: 종이 시험지가 아니라 실제 게임 카드. 문제 유형에 따라 카드 테두리와 상호작용만 달라짐
- 교사 화면: 게임 중에도 학생별 정답률과 연결 상태를 접이식 패널로 확인
- 학생 화면: 현재 할 행동 하나만 강조하고 설정/관리 기능은 숨김

### 대안 1: Illustrated Expedition

Root처럼 2.5D 일러스트 보드를 사용한다. 과학 탐험, 역사 여행, 우주, 생태 등 과목 테마를 빠르게 확장하기 좋고 저사양 기기 대응이 쉽다.

### 대안 2: Premium Tabletop

Wingspan과 Ticket to Ride처럼 종이, 목재, 금속 토큰의 재질을 강조한다. 중·고등학생에게 유아용 앱처럼 보이지 않으며 장기적으로 학교용 유료 제품 이미지에 유리하다.

## 한 턴의 권장 연출 시퀀스

1. 현재 플레이어 좌석 카드가 밝아지고 게임판 주변 정보가 살짝 어두워진다.
2. 중앙 하단의 주사위가 호흡하듯 한 번 강조된다.
3. 누르면 손/말의 짧은 준비 동작과 함께 주사위가 화면 안쪽으로 던져진다.
4. 주사위가 2~3회 실제로 충돌한 뒤 결과 면을 카메라가 0.5초 보여 준다.
5. 이동 경로의 다음 칸만 순차적으로 밝아지고 말이 한 칸씩 착지한다.
6. 마지막 칸에서는 카메라가 조금 가까워지고 타일 소품이 반응한다.
7. 퀴즈나 카드가 보드 중앙에서 솟아올라 정면으로 회전한다.
8. 정답 결과는 카드와 말, 점수판이 동시에 반응하되 다음 턴 전 1초 이상 읽을 시간을 준다.

## 화면별 레퍼런스 체크리스트

| 보드런 BoardRun 화면 | 1순위 레퍼런스 | 확인할 항목 |
|---|---|---|
| 홈/게임 라이브러리 | Blooket, Kahoot | 만든 퀴즈와 게임 모드의 분리, 최근 사용 항목 |
| 게임 만들기 | Blooket, Quizizz | 문제 세트 → 맵 → 규칙 → 미리보기의 단계 |
| 방 대기실 | Mario Party, Apple Game Center | 코드, QR, 학생 좌석, 준비 상태, 호스트 권한 |
| 게임판 | Monopoly GO, Board Kings, Game of Life | 카메라, 중심 무대, 주사위 CTA, 보드 물성 |
| 플레이어 HUD | Mario Party, Ticket to Ride | 현재 차례, 점수, 연결 상태, 최소 정보 |
| 퀴즈 카드 | Wingspan, Exploding Kittens 2 | 카드의 등장, 정보 순서, 정답 피드백 |
| 이벤트 카드 | Exploding Kittens 2, Cluedo | 카드 공개와 효과가 보드로 전달되는 연출 |
| 결과 화면 | Kahoot, Quizizz | 순위보다 학습 결과 우선, 다시 보기와 설명 |

## 피해야 할 방향

- 현재 웹페이지 위에 단순히 3D 주사위만 얹는 것
- 모든 정보를 흰색 둥근 카드에 담는 교육 SaaS 대시보드 문법
- 보드 바깥에 별도 테스트 패널이나 개발용 조작 영역을 항상 노출하는 것
- 주사위가 회전만 하고 바닥과 충돌하지 않는 것
- 말이 최종 위치로 순간 이동하거나 이동 중 카메라/경로 피드백이 없는 것
- 퀴즈를 게임판 아래쪽 폼으로 표시하는 것
- 타일을 색만 달리하고 재질, 아이콘, 실루엣을 동일하게 만드는 것
- 보드판보다 내비게이션, 사이드바, 배너가 더 강한 것
- 상용 게임의 캐릭터, 보드 모양, 카드 프레임, 음향을 그대로 복제하는 것

## 다음 디자인 단계에서 만들 산출물

1. 위 세 방향 중 하나를 고른 무드보드
2. 게임 화면의 와이드/태블릿/모바일 와이어프레임
3. 턴 연출 8단계 스토리보드
4. 보드, 타일, 말, 카드, 주사위의 재질·색상 토큰
5. 교사와 학생의 화면을 분리한 정보 구조
6. 실제 WebGL 주사위 성능 프로토타입
7. 한 개의 완성형 테마 맵을 먼저 만든 뒤 다른 맵에 확장

## 저작권 및 라이선스 메모

- 상용 게임의 스크린샷은 디자인 분석용 링크로만 남기고 프로젝트 자산에 포함하지 않는다.
- 레퍼런스에서 가져오는 것은 화면 계층, 연출 타이밍, 카메라 문법, 상호작용 원리다.
- 외부 자산은 다운로드 시점의 원본 라이선스 파일을 함께 보관한다.
- CC0라도 서로 다른 아트 스타일을 그대로 섞지 않고 보드런 BoardRun 전용 팔레트와 재질로 통일한다.
