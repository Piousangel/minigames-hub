# 모바일에서 보드를 만지면 페이지가 멈추던 문제, 35개 게임에서 고친 기록

미니게임 사이트를 혼자 만들고 있다. 모바일에서 게임 보드에 손가락을 올리고 세로로 밀면 페이지가 꿈쩍도 안 했다. 보드가 화면의 60~70%를 차지하니 한 번 게임에 들어가면 아래의 가이드와 리더보드로 내려가기가 불편했다.

원인은 내가 직접 넣은 코드였다. 조작을 위해 보드 전체에 `touch-none`(`touch-action: none`)을 줬고, 코드를 세어 보니 그런 컴포넌트가 37개였다. 이 글은 그걸 고치면서 배운 것과 어디까지 확인했고 어디는 못 했는지를 적은 기록이다.

{{img:01-2048.png}}

## touch-action은 조상과 교집합이다

처음엔 보드 안쪽 캔버스에 `pan-y`를 주면 되겠거니 했다. 안 된다. `touch-action`은 터치된 요소부터 위로 올라가는 조상들의 값을 **교집합**으로 계산한다. 부모가 `none`이면 자식이 `pan-y`로 풀 수 없다. 그래서 구조를 바꿔야 했다.

- 보드 컨테이너는 `touch-action`을 제한하지 않는다.
- 가운데 조작 구역에만 `none`을 건다.
- 위·아래 가장자리는 비워 둬서, 손가락을 얹고 밀면 페이지가 스크롤되게 한다.

이 구조를 공통 컴포넌트 `PlayZone`으로 뺐다. 핵심은 이 정도다.

```tsx
export function PlayZone({ top = 0.12, bottom = 0.12, left = 0, right = 0, axis = 'none', className, style, ...rest }: PlayZoneProps) {
  const pct = (n: number) => `${Math.max(0, Math.min(0.45, n)) * 100}%`
  const s: CSSProperties = { position: 'absolute', top: pct(top), bottom: pct(bottom), left: pct(left), right: pct(right), touchAction: axis, zIndex: 3, ...style }
  return <div data-play-zone="" aria-hidden="true" className={className} style={s} {...rest} />
}

export function inPlayZone(e: { target: EventTarget | null }): boolean {
  const t = e.target
  return t instanceof Element && t.closest('[data-play-zone]') !== null
}
```

기본 스크롤 띠는 위·아래 각 12%다. 가로로만 조작하는 게임(Breakout 같은)은 `axis`를 `pan-y`로 준다. 2048에서는 `<PlayZone />`을 보드 안에 한 줄 넣고, 터치 시작 핸들러 맨 앞에서 가장자리 터치를 버린다.

```tsx
const onTouchStart = (e: React.TouchEvent) => {
  if (!inPlayZone(e)) {
    touchStart.current = null // 가장자리 스크롤 띠에서 시작한 터치는 게임 입력이 아니다
    return
  }
  touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
}
```

## 먼저 36개를 분류했다

한꺼번에 바꾸기 전에 게임을 입력 방식별로 나눴다. 분류 문서에서 가장 중요했던 건 이 점이다. `touch-action`을 풀면 스크롤이 시작될 때 브라우저가 `pointercancel`을 보내는데, **그 전에 `pointerdown`은 이미 발화했다.** `pointerdown`에서 바로 동작하는 탭 게임(점프, 발사, 두더지 때리기)은 스크롤하려고 손가락을 대는 순간 게임 동작이 한 번 들어간다. 그래서 가장자리 터치는 `inPlayZone`으로 무시하는 쪽을 택했다.

또 드래그형 게임은 `pointercancel`을 '취소'로 처리해야 한다. 분류 중에 WordSearch는 cancel에서 정답 검사까지 돌리고, Unblock은 cancel에서 블록 이동을 확정하는 걸 발견했다. 스크롤이 취소를 유발하는 구조에서는 이게 버그가 된다.

대부분의 게임은 입력 구조가 같아서 PlayZone으로 묶어 처리할 수 있었다. 예외도 있었다. Hogline은 이미 핸들 원에만 `none`이 걸려 있었고, Shadowfit은 176px 패널이라 나머지 UI에서 스크롤이 된다. FizzBeat·MorseRelay·Slosh·Tetris는 작은 버튼형이라 건드리지 않았다. 멀티터치(두 손가락 되감기)를 쓰는 Backspace는 보드의 `none`이 필요해서, 분류 문서에서는 중앙 구역만 `none`으로 두고 상하 띠 탭은 무시하는 방식을 권장안으로 잡았다.

## CDP 터치로 쟀다

"되는 것 같다"로 끝내고 싶지 않아서 Playwright에서 CDP의 `Input.dispatchTouchEvent`로 터치를 보내고 `scrollY`가 얼마나 변하는지 쟀다. 먼저 고친 뿅 착지(Plop)에서는 가운데 스와이프는 0px, 위 띠는 +65px, 아래 띠는 +112px이었다. 가운데와 아래 띠에서 누르기 점프도 정상이었다. 이후 배치까지 합친 35개 게임 적용분의 측정에서는 조작 구역 0px, 가장자리 약 +75~128px이 나왔다. 2048 이동, Flappy 시작, Breakout 패들, AcornHop의 띠 탭 무시·가운데 탭 발사, GemMatch 칸 스와이프가 그대로 되는 것도 확인했다.

작업은 PR 네 개로 나눠 들어갔다(Plop #75, 1차 9개 #79, 2차 11개 #83, 2차 10개 #84).

{{img:02-snake.png}}

## 아직 모르는 것, 안 되는 것

솔직히 적어 둔다.

- **실기기 확인을 못 했다.** 위 측정은 전부 에뮬레이션(CDP 터치)이다. iOS Safari와 Android Chrome 실기기에서는 아직 안 봤다. 특히 Unblock의 가로 `pan-y`·세로 `pan-x` 블록, 두 손가락 되감기가 띠에 걸칠 때의 Backspace는 실기기에서 확인해야 한다.
- **끝 줄에서 시작하는 드래그는 취소된다.** WordSearch·GemMatch·Nonogram에서 위·아래 끝 줄에서 시작하는 세로·대각선 드래그는 스크롤로 넘어가 취소된다. 다른 쪽 끝에서 시작하거나 탭-탭 폴백을 쓰면 된다. 완벽한 해결이 아니라 타협이다.
- Polarity의 '탭하여 시작' 카드는 띠에서 누르면 시작되지 않는다.
- BubbleShooter의 마우스 조준선은 위·아래 12% 띠에서 갱신되지 않는다.

그리고 스크롤 띠의 비율(기본 12%, Plop은 14%/16%)은 사용자 데이터로 정한 값이 아니라 설계값이다.

## 정리

- 조상이 `none`이면 자식은 못 푼다. 컨테이너는 비우고 조작 구역에만 건다.
- 탭 게임은 `pointerdown`이 이미 나간 뒤에 스크롤이 시작된다. 가장자리 터치는 입력에서 제외한다.
- 드래그형은 `pointercancel`을 '확정'이 아니라 '취소'로 처리한다.
- 에뮬레이션으로라도 `scrollY`를 숫자로 재 두면 "된 것 같다"가 사라진다. 다만 실기기는 따로 봐야 한다.

모바일에서 [2048](https://quickminigames.site/2048?ref=velog)을 열어 보드 위아래 가장자리를 밀면 어떻게 동작하는지 볼 수 있다. 터치 환경에서 이상한 동작을 발견하면 알려 주면 고맙겠다.

{{img:03-flappy.png}}
