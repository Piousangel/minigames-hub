---
title: "touch-action Is an Intersection: Un-trapping Page Scroll on 35 Mobile Games"
description: "Full-board touch-action: none made the page unscrollable on phones. Here is how I fixed it across 35 canvas and DOM games, what I measured, and what I could not verify."
tags: webdev, javascript, css, mobile
---

I'm building a small site of free browser minigames. On a phone, if you put a finger on a game board and drag vertically, the page would not scroll. The board takes up 60-70% of the screen, so once you were in a game, getting down to the guide and leaderboard below it was awkward.

I caused this myself. To make touch controls work, I had put `touch-action: none` on the whole board. Counting afterwards, 37 components did this. This post covers the fix, how I measured it, and the parts I have not verified.

{{img:01-2048.png}}

## The rule that bit me: touch-action is an intersection

My first idea was to set `pan-y` on the inner canvas. That does nothing. The browser computes `touch-action` as the **intersection** of the values on the touched element and its ancestors, so a child cannot re-enable something a parent disabled with `none`.

The structure has to change instead:

- The board container does not restrict `touch-action`.
- Only a central "play zone" overlay gets `touch-action: none`.
- The top and bottom edges are left alone, so a finger resting there and dragging scrolls the page.

I extracted this into a shared `PlayZone` component:

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

The default scroll bands are 12% at the top and bottom. Games that only use horizontal input pass `axis="pan-y"`. In 2048 the change is one `<PlayZone />` inside the board plus a guard at the start of the touch handler:

```tsx
const onTouchStart = (e: React.TouchEvent) => {
  if (!inPlayZone(e)) {
    touchStart.current = null // a touch that starts in the edge scroll band is not game input
    return
  }
  touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
}
```

## Classify before you change anything

Before touching 36 games I sorted them by input style. The most important finding: when you relax `touch-action`, the browser fires `pointercancel` once a scroll gesture begins, but **`pointerdown` has already fired by then.** A tap game that acts on `pointerdown` (jump, shoot, whack a mole) registers one input the moment you put a finger down to scroll. So touches that start in the edge bands are ignored via `inPlayZone`.

Drag games must treat `pointercancel` as a cancel, not a commit. While classifying I found WordSearch ran its answer check on cancel, and Unblock committed the block move on cancel. Both become bugs once scrolling can cancel a gesture.

Some games needed no change: Hogline already only disables touch on its handle, Shadowfit is a 176px panel with scrollable UI around it, and FizzBeat, MorseRelay, Slosh and Tetris are small button-style controls. Backspace uses a two-finger rewind gesture, so the classification doc recommends `none` in the central zone only, with taps in the top and bottom bands ignored.

## Measuring with CDP touch events

I did not want to stop at "seems to work", so I sent touches through CDP `Input.dispatchTouchEvent` from Playwright and measured how far `scrollY` moved. On the first game I fixed (Plop), a swipe in the center scrolled 0px, the top band +65px and the bottom band +112px, and tap-to-jump still worked. Across the 35 games in total: 0px in the play zone and roughly +75 to +128px from the edges. I also confirmed 2048 moves, Flappy starts, the Breakout paddle follows, AcornHop ignores taps in the bands but fires from the center, and GemMatch swipes still work.

It shipped as four PRs (Plop #75, first batch of 9 #79, then 11 in #83 and 10 in #84).

{{img:02-snake.png}}

## What I haven't verified, and known limits

- **No real-device testing yet.** All measurements above are emulated CDP touch. I haven't checked iOS Safari or Android Chrome on hardware. Unblock's horizontal `pan-y` / vertical `pan-x` blocks and Backspace's two-finger rewind near the bands are the cases I most want to see on a real phone.
- **Drags that start on the first or last row get cancelled.** In WordSearch, GemMatch and Nonogram, a vertical or diagonal drag starting at an edge row turns into a scroll and is cancelled. Starting from the other end, or using tap-then-tap in GemMatch, works around it. It is a compromise, not a clean fix.
- Polarity's "tap to start" card doesn't start if you press it in a band.
- BubbleShooter's mouse aim line doesn't update inside the 12% top and bottom bands.

The band sizes (12% by default, 14%/16% on Plop) are design choices, not derived from user data.

## Takeaways

- If an ancestor says `none`, a child can't undo it. Leave the container unrestricted and put the restriction on a smaller zone.
- Tap-on-`pointerdown` games get the input before the scroll starts, so exclude edge touches.
- Treat `pointercancel` in drag handlers as cancel, never commit.
- Even emulated `scrollY` numbers beat "seems fine", but real devices still need their own pass.

If you want to see the behavior, open [2048](https://quickminigames.site/2048?ref=devto) on a phone and drag from the top or bottom edge of the board.

{{img:03-flappy.png}}

*Drafted with AI assistance.*
