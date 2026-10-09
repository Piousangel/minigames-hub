export const guide = {
  slug: 'bisect',
  title: 'Bisect Strategy: Why the Best Tap Comes About 0.9 Seconds After the Start Flash',
  description:
    'Bisect never shows you the end flash in time to use it. Here is the exact interval range, the grading windows, and the tap delay that survives longest.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'The one rule that changes everything',
      paragraphs: [
        'Most people approach Bisect as "watch the start, watch the end, tap halfway." The code does not allow that. The halfway point always comes before the end signal, and the moment you tap, the round is judged and over. So in any round you score, you have seen the start flash and nothing else. The end flash only appears if you have not tapped yet when it fires — and by then every possible tap is already past the midpoint by at least half the interval, which grades as a miss.',
        'In other words, Bisect is not a reaction game and not really a "split the interval" game. It is a prediction game: after the start flash, choose when to tap without knowing how long this round will be. Once you accept that, the right strategy becomes something you can calculate, and that is what this guide does. All figures come from scripts/content-sims/bisect.ts in this site\'s repository, which uses the game\'s real grading function.',
      ],
    },
    {
      heading: 'How a round is built',
      paragraphs: [
        'The game counts time in ticks of 1/60 of a second. When you arm a round, it secretly picks two numbers:',
      ],
      list: [
        'A lead-in of 20 to 90 ticks (about 0.33 to 1.5 s) before the start flash. Tapping during this wait is a false start and costs a life.',
        'An interval of 30 to 180 ticks (0.5 to 3.0 s) between the start and end signals, every whole-tick length equally likely. That is 151 possible lengths.',
        'The two picks are independent, so a long lead-in tells you nothing about the interval, and nothing carries over from one round to the next.',
        'If you never tap, the round times out one second (60 ticks) after the end signal and also costs a life.',
      ],
    },
    {
      heading: 'How taps are graded',
      paragraphs: [
        'Your error is measured relative to the size of the round. The game takes the distance between your tap and the true midpoint and divides it by half the interval. Within 6% is Perfect (100 points), within 18% is Good (60), within 40% is OK (25), and anything further is a Miss that costs one of your three lives. Early and late errors are treated identically.',
        'Because the windows scale, short rounds are brutal and long ones are forgiving. For the shortest possible interval (0.5 s, midpoint at 0.25 s) the Perfect window is a single tick and the OK window runs from tick 9 to tick 21 after the start. For the longest (3.0 s, midpoint at 1.5 s) Perfect spans ticks 85–95 and OK spans ticks 54–126 — more than a full second of acceptable taps.',
        'Every consecutive non-miss also adds a streak bonus of 10 points per hit after the first, so the fourth hit in a row is worth its grade plus 30. A miss resets the streak to zero.',
      ],
    },
    {
      heading: 'The numbers: what each tap delay is worth',
      paragraphs: [
        'Since you cannot know the interval, the honest question is: if you always tap a fixed time after the start flash, how often does that tap land? The script checked every delay from 10 to 100 ticks against all 151 interval lengths, grading each with the game\'s own judge. Some representative rows:',
      ],
      list: [
        '0.50 s after the start: 61.6% miss, 4.6% Perfect, 16.8 expected base points.',
        '0.67 s: 49.7% miss, 6.6% Perfect, 22.2 points.',
        '0.90 s: 31.8% miss — the lowest of any delay — with 8.6% Perfect, 17.9% Good, 41.7% OK and 29.8 points.',
        '1.00 s: 37.1% miss, 9.3% Perfect, 29.9 points.',
        '1.17 s: 46.4% miss, 10.6% Perfect, 29.7 points.',
        '1.42 s: 60.9% miss, 13.2% Perfect, 23.4 points.',
      ],
    },
    {
      heading: 'Survival beats perfection',
      paragraphs: [
        'Look at how the table pulls in two directions. Tapping later raises your Perfect rate, because the long rounds have wide windows, but it also misses every short round outright. The single delay with the best expected base points per round is 1.05 s (30.2 points), only a hair better than 0.9 s. But points per round is the wrong target, because a miss ends your streak and eats a life.',
        'To settle it, the script also played complete three-life runs through the real arm, step and tap functions — 20,000 runs per setting. With perfectly consistent timing, tapping at 0.90 s averaged 422 points over 9.47 rounds; tapping at 1.00 s averaged 330 points over 8.11 rounds; at 1.17 s it fell to 233. Staying alive longer is what feeds the streak bonus, and the streak bonus is where long runs get their score.',
        'Humans are not metronomes, so the runs were repeated with random timing noise added to each tap — a modelling assumption, not a measurement of real players. With a 10% wobble the 0.90 s target still led at 330 points per run (8.27 rounds), and with 15% wobble it held a narrow lead at 293 against 282 for 1.00 s. The advice survives sloppiness: aim a little under one second.',
      ],
    },
    {
      heading: 'How to actually hit 0.9 seconds',
      paragraphs: [
        'Ninety-hundredths of a second is shorter than most people think. A useful anchor is that one second is 60 ticks in this game, so you are aiming for just under one beat of a 60-beats-per-minute pulse. The results screen shows a signed error in milliseconds after each tap, but be careful reading it: that number mixes your timing with the random length of the round, so a single result says little about you. The miss rate is the better gauge. A steady 0.9 s tap should land on about two rounds out of three (68.2% in the calculation above). If you are missing much more often than one round in three, your delay is drifting, and the sign of your errors on the misses tells you which way: positive means late, negative means early.',
        'A few habits help keep the delay steady:',
      ],
      list: [
        'Tap the instant your count lands rather than waiting to "feel" the midpoint. Hesitation only adds variance.',
        'Do not react to the end flash. If you see it, that round is already lost; tapping afterwards cannot rescue it.',
        'Keep the same input device for a whole run. The game times your tap against its most recent animation frame, so input latency differs between a keyboard and a touchscreen.',
        'Expect to miss short rounds. With a 0.9 s target any interval shorter than 78 ticks (about 1.29 s) cannot reach even OK. That is 48 of the 151 possible lengths, and it is the whole of the 31.8% miss rate. Losing those is the price of surviving everything else.',
      ],
    },
    {
      heading: 'What the page hints get wrong, and what they get right',
      paragraphs: [
        'You may read elsewhere that you should "watch for the end flash and tap halfway." In this version that is not possible, for the reasons above. Likewise, the idea that a fixed rhythm will not carry over between rounds is backwards: a fixed rhythm is precisely the best available play, because each round is drawn independently and you never get information about its length before you must commit.',
        'What is true is that early and late errors cost the same, that consistency matters more than any single great tap, and that the streak bonus rewards long runs. Bisect is a test of how reliably you can reproduce one short interval under pressure — and once you treat it that way, your average run will climb.',
      ],
    },
  ],
}
