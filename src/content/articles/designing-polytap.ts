import type { Article } from '../types'

export const article: Article = {
  slug: 'designing-polytap',
  title: 'Designing Polytap: a rhythm game where precision is not the point',
  description:
    'Why Polytap keeps a fixed, generous timing window, makes three-against-four its whole identity, and why we stopped letting players die in the warm-up.',
  published: '2026-10-09',
  kind: 'design-notes',
  relatedGames: ['polytap'],
  sections: [
    {
      heading: 'The idea: two clocks, two hands',
      paragraphs: [
        'Polytap has two keys. F belongs to a clock that ticks every 3 beats; J belongs to a clock that ticks every 4. Each hand only has to follow its own pulse, which on its own is trivial. The game is what happens when you run both at once. Three against four is a classic polyrhythm: the two pulses drift apart, cross, and come back together every 12 beats. At that meeting point, both keys are due at the same moment, and you have to strike them together.',
        'Our one-line pitch for it was “keep two out-of-phase clocks alive at the same time.” Most rhythm games ask you to follow one stream of notes that gets denser. Polytap asks you to split your attention into two independent streams that keep interfering with each other.',
      ],
    },
    {
      heading: 'The constraint: interference, not accuracy',
      paragraphs: [
        'The first design decision was negative. We decided precision would not be the axis of difficulty. The judgement window is ±1/4 of a beat and it never shrinks, at any stage. There are no Perfect or Great grades either: any hit inside the window scores the same 10 points. The engine source says it plainly, next to the constant: “Never shrinks — this is the design.”',
        'We did this because a shrinking window turns every rhythm game into the same game. If the timing gets tighter, the challenge becomes reflexes, and the specific thing that makes polyrhythm hard, keeping two pulses independent, gets buried under it. With a fixed, forgiving window, nearly every failure in Polytap is the interesting kind: you played J on the F pulse, or you hesitated because the two clocks were about to collide.',
        'Tempo does rise, but gently. The game starts at 96 BPM, adds 4 BPM per stage, and stops at 132. At 96 BPM a beat lasts 625 ms, so the window is about ±156 ms; at the 132 BPM cap it is still about ±114 ms. That is a deliberately wide target. Tempo is the core of another game on the site, Flywheel, and we did not want Polytap to become a second version of it.',
      ],
    },
    {
      heading: 'The collision is sudden death',
      paragraphs: [
        'If the window is generous, something else has to carry the threat. In Polytap it is the confluence, the beat where both clocks are due. You have 3 lives for ordinary misses, but if you drop either half of a confluence, the run ends immediately, no matter how many lives are left. The confluence notes are drawn in amber rather than the lane colors, and the hint text says it directly once both clocks are running: miss the bright column and the run ends.',
        'We added a second, quieter rule that we think makes the game honest. Tapping a key when nothing is due is a stray, and a stray costs a life. But a stray does not consume the next note. That beat still arrives and, if you do not hit it properly, it counts as a miss as well. The double punishment is intentional. It tends to happen exactly when your two hands start bleeding into each other, which is the failure the game is about.',
      ],
    },
    {
      heading: 'How a run is structured',
      paragraphs: [
        'Every stage is a pair of periods. Stage 1 is always 3 against 4, with no randomness, because that pairing is the game’s identity and every player should meet it first. From stage 2 onward, the game picks a new pair from a short list, never repeating the pair you just played:',
      ],
      list: [
        '3 against 4 — cycle of 12 beats, 4 cycles per stage',
        '3 against 5 — cycle of 15 beats, 3 cycles per stage',
        '4 against 5 — cycle of 20 beats, 2 cycles per stage',
        '3 against 7 — cycle of 21 beats, 2 cycles per stage',
        '4 against 7 — cycle of 28 beats, 2 cycles per stage',
      ],
    },
    {
      heading: 'Keeping stages the same length',
      paragraphs: [
        'Longer cycles would make some stages drag, so the number of cycles per stage is derived from a target of 48 beats: divide 48 by the cycle length, round, and clamp the result between 2 and 4. That is where the numbers in the list above come from. Each stage feels roughly the same length even though 4 against 7 only lines up once every 28 beats.',
        'When a stage ends, both clocks are re-phased onto the confluence beat that just closed it. The next pair starts counting from that exact beat, so the music does not hiccup between stages. Notes appear two beats before they are due, which gives you a short runway to see the next collision coming.',
      ],
    },
    {
      heading: 'Scoring',
      paragraphs: [
        'Because there are no grades, the score has to reward the structure of the run instead. Ordinary hits are worth 10. Each cleared confluence pays 100 times the number of confluences you have cleared so far, so the hundredth collision is worth far more than the first. If you hit F and J within 2 ticks of each other at a confluence (the engine counts 12 ticks per beat), that counts as a lock and adds another 50. Entering a new stage adds 250 times the stage number. The score never goes down.',
        'The headline record is cycles cleared, not hits. Warm-up cycles do not count toward it, which turned out to matter for the change described next.',
      ],
    },
    {
      heading: 'The change: you can no longer die in the warm-up',
      paragraphs: [
        'Polytap does not start with both clocks. It opens with a warm-up: only J, ticking every 4 beats, after a four-beat count-in. Once you have landed J on 4 warm-up cycles, F joins and stage 1 begins. That is the onboarding: learn one pulse, then get the second.',
        'In the first build, warm-up misses cost lives like any other miss. Playing the game in a browser before it went live showed the problem: a new player who missed J three times was out of lives before F had ever appeared. In other words, you could fail the tutorial and never see the actual game. For a game whose entire hook is the moment the second clock joins, that was the worst possible first thirty seconds.',
        'The fix, which went live together with the game itself, made stage 0 a no-fail sandbox. In the warm-up, misses and strays still count, still play their error sound, flash the lanes red and still show up in your stats, so you keep learning the timing. They just do not cost lives. The gate into stage 1 was kept exactly as it was: you still have to land J on four warm-up cycles. Survival is no longer the gate; skill is. From stage 1 onward, nothing changed: misses cost lives and a dropped confluence still ends the run.',
        'The tests were updated to match. The test that used to check for life loss during the warm-up was rewritten to assert the opposite, and the coverage for running out of lives was moved to stage 1 and later. In the browser, six seconds with no input at all now leaves you alive in the warm-up, where before it ended the run.',
      ],
    },
    {
      heading: 'A playtest lesson that went the other way',
      paragraphs: [
        'During the same round of browser checks, Polytap at first looked broken: the F pad did not respond. It turned out the check itself was wrong. In the warm-up, the F pad is disabled on purpose, because F has not joined yet. The game was fine; the test was poking at a key that was not supposed to work yet.',
        'We wrote that one down because it was the mirror image of an earlier mistake, where a game passed every unit test and still could not be played with a mouse. The rule we took away is simple and a little uncomfortable: a red result is not proof the game is broken, and a green one is not proof it works. You have to look at the real screen to tell which.',
      ],
    },
    {
      heading: 'Engineering choices that serve the design',
      paragraphs: [
        'Time inside the engine is an integer tick count, 12 ticks per beat, and every judgement is integer arithmetic, so there is no floating-point drift between the two clocks over a long run. The engine does not read a clock at all; the component converts real milliseconds into ticks and hands over only whole numbers. Randomness enters in one place, the pair draw at stage 2 and later, through an injected seeded generator. A whole run can be replayed exactly from its seed and the list of key presses, which is what lets the tests pin down specific runs.',
        'In the browser, a frame can advance at most 100 ms of game time, and switching to another tab pauses the clocks instead of letting the run die in the background.',
      ],
    },
    {
      heading: 'What is next',
      paragraphs: [
        'The pair list stops at 4 against 7, and every pair in it is coprime. A pair with a common factor, like 4 against 6, would collide every 12 beats while sounding much less tangled, so if the list grows, a pair like 5 against 7 is the natural candidate rather than anything with a shared factor. We are also interested in whether the lock bonus is visible enough. Right now a lock shows as a small badge, and the difference between a lock and a plain confluence is mostly felt rather than seen. Those are tuning questions, though. The two rules that define the game, the window that never shrinks and the collision that ends the run, are staying.',
      ],
    },
  ],
}
