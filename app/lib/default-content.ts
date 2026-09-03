import type { CardInput } from "./game-content";

// 새 게임을 만들면 공용 풀에 기본으로 들어가는 카드 덱.
// 모노폴리·부루마블식 보드카드를 교실 규칙에 맞게 변형했다.
// 모든 카드는 칸 미지정(tileIndex null)이라 이벤트·보너스 칸에 순환 배치된다.
export const defaultCardPack: CardInput[] = [
  {
    title: "복지 기금 수령",
    description: "사회복지기금 통장이 개설되었습니다. 학습 점수 +10점을 받습니다.",
    effectType: "SCORE_BONUS",
    effectValue: 10,
  },
  {
    title: "황금 열쇠 발견",
    description: "복습의 황금 열쇠를 찾았습니다. 학습 점수 +5점을 받습니다.",
    effectType: "SCORE_BONUS",
    effectValue: 5,
  },
  {
    title: "우주여행 보너스",
    description: "오늘의 집중력이 대단합니다. 주사위 없이 3칸 앞으로 갑니다.",
    effectType: "MOVE_FORWARD",
    effectValue: 3,
  },
  {
    title: "지문 조사 명령",
    description: "교실 탐정단 출동! 2칸 뒤로 물러나 다시 살펴봅니다.",
    effectType: "MOVE_BACK",
    effectValue: 2,
  },
  {
    title: "명상 휴식",
    description: "긴장을 풀고 심호흡하세요. 한 차례 쉬고 다시 집중합니다.",
    effectType: "SKIP_TURN",
    effectValue: 0,
  },
  {
    title: "한 번 더!",
    description: "집중력 폭발! 주사위를 한 번 더 굴릴 수 있습니다.",
    effectType: "EXTRA_TURN",
    effectValue: 0,
  },
];