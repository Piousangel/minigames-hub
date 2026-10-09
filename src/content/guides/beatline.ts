export const guide = {
  slug: 'beatline',
  title: 'Beatline Timing Guide: Windows, Multipliers and the Cost of a Miss',
  description:
    'Beatline’s exact timing windows, combo maths and stage data, plus 5,000 simulated runs showing how much timing precision it takes to clear all five stages.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'The windows, in milliseconds',
      paragraphs: [
        'Beatline judges every press against the moment the note reaches the line, counted in 10 ms steps. Within 50 ms either side is a Perfect. Within 120 ms either side is a Good. Anything further out is not a late or early hit — it is a press with nothing to hit.',
        'That last point is the one that costs runs. A press that finds no note in its lane inside the 120 ms window counts as a miss on its own: you lose a life and your combo. A note you never hit is also a miss, judged 120 ms after it passes the line. So a press 150 ms early on a real note is punished twice — once for the empty press, and again when the note sails by. In our simulation, a single press 150 ms too early on the sixth note cost 2 lives, not 1.',
        'You have 4 lives for the whole run, not per stage, and nothing refills them. Four misses anywhere across the five stages ends the run, whether they come from skipped notes or stray taps.',
      ],
    },
    {
      heading: 'What each stage throws at you',
      paragraphs: [
        'All five charts are built from a rhythmic grid: notes can only appear on fixed slots, each slot spawns a note with a set probability, and a lane is chosen at random. No two notes ever share a slot, so there are no chords — only one key is ever needed at a time. Notes in the same lane are always at least 250 ms apart. Each note appears 1.5 seconds before it reaches the line.',
        'We generated the charts for 1,000 seeds with the game’s own generator (scripts/content-sims/beatline.ts) to see what a typical run looks like. Every chart hit its full note count, so a run is always 140 notes.',
      ],
      list: [
        'Stage 1: 96 BPM, notes on a 320 ms grid, 20 notes, last note after 18.4 s on average, 1.09 notes per second.',
        'Stage 2: 108 BPM, 280 ms grid, 24 notes, 16.7 s, 1.43 notes per second.',
        'Stage 3: 120 BPM, 250 ms grid, 28 notes, 15.5 s, 1.81 notes per second.',
        'Stage 4: 132 BPM, 150 ms grid, 32 notes, 10.7 s, 3.00 notes per second.',
        'Stage 5: 144 BPM, 140 ms grid, 36 notes, 10.1 s, 3.56 notes per second.',
      ],
    },
    {
      heading: 'The real difficulty jump is stage 4',
      paragraphs: [
        'Stages 1 to 3 speed up gradually; stage 4 does not. The grid switches from two slots per beat to three, the tightest gap between notes drops from 250 ms to 150 ms, and note density jumps from 1.81 to 3.00 per second. Stage 5 is only a small step beyond that.',
        'There is one more change hidden in those numbers. In stages 1 to 3, about a quarter of consecutive notes land in the same lane as the one before (24.8% to 25.1% in our charts). In stages 4 and 5 that drops to 13.9% and 12.4%, because a lane cannot be reused within 250 ms. Fast stages are therefore mostly runs that hop from lane to lane, and same-finger repeats only appear when they are slower. If your hands are going to break down, it will be on rapid alternation across D, F, J and K, so that is what to warm up.',
      ],
    },
    {
      heading: 'Combo and multiplier maths',
      paragraphs: [
        'A Perfect is worth 300 and a Good 100, times your multiplier. The multiplier is 1 plus one for every 10 combo, capped at ×5, and it uses the combo you had before the hit. In practice: notes 1–10 of a streak score ×1, 11–20 ×2, 21–30 ×3, 31–40 ×4, and from the 41st note on ×5.',
        'Your combo carries over between stages. It is only reset by a miss, so a clean run reaches ×5 inside stage 2 and keeps it all the way to the end. Clearing a stage adds 200 times the stage number, a stage with no misses adds another 500, and clearing stage 5 adds 2,500 on top.',
        'Put together, a perfect run scores 188,000. A run where every single hit is a Good scores just 68,000 — which shows how much of the score lives in the Perfect window.',
      ],
    },
    {
      heading: 'A miss in the middle costs the most',
      paragraphs: [
        'Because the multiplier rebuilds slowly, where you miss matters far more than how many points the note itself was worth. We replayed an otherwise perfect run and skipped exactly one note at different points.',
        'Missing the first or last note costs 2,000 points. Missing the tenth costs 12,800, and the eleventh 14,000, because now the whole ×2 to ×5 climb starts later. Missing a note in the middle of the run, once you are at ×5, costs 32,000 — it takes 40 notes of perfect play to get back to full multiplier.',
      ],
      list: [
        'Skip note 1: −2,000.',
        'Skip note 11: −14,000.',
        'Skip note 71 of 140: −32,000.',
        'Skip note 140: −2,000.',
      ],
    },
    {
      heading: 'How precise do you need to be?',
      paragraphs: [
        'To put numbers on skill, we simulated players whose timing errors follow a bell curve, ran 1,000 runs at each level of precision through the real game logic, and recorded how often they cleared all five stages. The spread of the timing error (the standard deviation) is what changes between rows.',
        'The results are steep. A player whose typical error is 35 ms clears the run 99.9% of the time and averages 173,204 points. At 50 ms, the win rate falls to 51.6% and the average score to 102,971. At 65 ms, only 0.2% of runs survive and the average run gets no further than stage 2. The difference between a comfortable clear and no chance at all is about 30 ms of consistency.',
        'The 50 ms group is worth a closer look. Their 484 failed runs were spread across every stage — 29, 68, 108, 132 and 147 losses in stages 1 to 5 — climbing towards the end. That is the shared pool of four lives at work: a run does not die on one hard passage but from misses collected along the way, so the last stages kill the most runs even though the simulated timing error never changes. Real hands do get sloppier as notes speed up, which our model leaves out, so if anything the late stages are harder than these figures suggest.',
      ],
      list: [
        '20 ms spread: 100% of runs won, average 187,306, 99.4% of hits Perfect.',
        '35 ms spread: 99.9% won, average 173,204, 88.7% Perfect.',
        '50 ms spread: 51.6% won, average 102,971, 73.9% Perfect.',
        '65 ms spread: 0.2% won, average 19,372, 63.8% Perfect.',
        '80 ms spread: 0% won, average 5,090, and 670 of 1,000 runs over in stage 1.',
      ],
    },
    {
      heading: 'Habits that follow from the numbers',
      paragraphs: [
        'Never tap to be safe. A press with no note in range is a full miss, and an early guess can become two. If you lose the rhythm, let the note go and catch the next one: one miss is cheaper than two.',
        'Consistency beats speed. If your hits land as Goods because you are always slightly late, you are already inside the window and simply need to shift your timing by a few tens of milliseconds, not by a big fraction of a beat — half a beat is between 210 and 315 ms here, more than double the whole Good window.',
        'Protect the middle of the run. The expensive misses are the ones at full multiplier, in stages 3 to 5, and because lives never refill, a miss you shrug off in stage 1 is a life you will want back in stage 5. Stage 4 brings the biggest jump in density, so practise that pace specifically.',
      ],
    },
    {
      heading: 'Daily runs and practice',
      paragraphs: [
        'Daily mode builds the chart from the UTC date, so everyone gets identical notes that day and you can replay it as often as you like; your daily streak only grows when you win a daily run. Practice starts a full five-stage run on a fresh random chart every time. Both modes count towards your saved best score. Between stages the game waits for you — press Space or Enter, or the on-screen button, when you are ready.',
      ],
    },
  ],
}
