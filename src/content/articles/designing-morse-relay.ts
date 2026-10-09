import type { Article } from '../types'

export const article: Article = {
  slug: 'designing-morse-relay',
  title: 'Designing Morse Relay: a telegraph key that learns your hand',
  description:
    'How Morse Relay turns real Morse keying into a survival game: self-calibrating timing, a tolerance that tightens each level, and unranked challenge runs.',
  published: '2026-10-09',
  kind: 'design-notes',
  relatedGames: ['morse-relay'],
  sections: [
    {
      heading: 'The idea: one key, real code',
      paragraphs: [
        'Morse Relay asks you to send a word the way a telegraph operator would. There is one key. You hold it briefly for a dot, longer for a dash, and the length of the silence between presses tells the receiver whether you are still inside a letter, moving to the next letter, or starting a new word. There is no on-screen keypad of dots and dashes to tap, and no multiple choice. If your timing is wrong, the message is wrong.',
        'We wanted a game where the input itself is the skill. Most typing games test whether you know which key to press. Morse is different: everyone presses the same key, and all of the information lives in duration. That makes it language-light, too. The words are short English words and radio phrases, but you do not need to read English well to key S-O-S, because the screen shows every letter’s pattern as you go.',
        'It is a survival game rather than a lesson. You start with 5 lives, each word you finish raises the level, and the run ends when the lives are gone.',
      ],
    },
    {
      heading: 'The constraint that makes it a game: timing is relative',
      paragraphs: [
        'International Morse is defined in units, not milliseconds. A dot is 1 unit, a dash is 3, the gap between symbols inside a letter is 1, between letters 3, and between words 7. How long a unit lasts is up to the operator. That is the rule we built around, and it created the first real design problem: whose unit?',
        'A fixed tempo would be unfair in both directions. A beginner keying slowly would see every careful dash read as too long, and a fast player would be held back by a speed limit they never agreed to. So the engine does not have a tempo. It learns one. The first press of every word is taken as the reference: if the word starts with a dot, that press is defined as 1 unit; if it starts with a dash, the press is divided by 3. The result is clamped between 40 ms and 600 ms per unit, which covers roughly 30 words per minute down to 2.',
        'A side effect we liked: your first press can never be wrong. Because it is the ruler everything else is measured against, it is always the right length by definition. The pressure starts on the second symbol, which is exactly when a new player has had one moment to feel the key.',
        'The calibration resets for every word. Your WPM is recomputed each time with the standard formula, 1200 divided by the unit length in milliseconds, and the best value across the run is what the game reports. Speeding up is something you choose to do, word by word, not something the game forces on you.',
      ],
    },
    {
      heading: 'Where the boundaries sit',
      paragraphs: [
        'Once a unit exists, every press and every gap has to be sorted into a category. We put the boundaries halfway between the ideal values so the error budget is symmetric:',
      ],
      list: [
        'Dot or dash: a hold of up to 2 units is a dot; anything longer is a dash (the midpoint between 1 and 3).',
        'Symbol gap or letter gap: silence up to 2 units continues the current letter; longer ends it.',
        'Letter gap or word gap: silence up to 5 units is a letter break; longer is a word break (the midpoint between 3 and 7).',
        'Abandon: 3 seconds of silence forces the current letter to resolve, so a stalled run never hangs forever.',
      ],
    },
    {
      heading: 'Correct versus clean',
      paragraphs: [
        'Those boundaries decide whether a symbol is right. A separate check decides whether it was clean, meaning close to the ideal length rather than merely on the right side of the midpoint. This split is what gives the game a ceiling. A wrong symbol costs a life; a sloppy but correct one costs only your combo.',
        'The clean window is a fractional tolerance that tightens as you level up. At level 1 a symbol may be 55% away from its ideal length and still count as clean. Each level removes 8 percentage points, so level 2 allows 47%, level 3 allows 39%, and from level 6 on it bottoms out at 15%. The ruler stays yours, but the game gets fussier about how steadily you hold it.',
        'Word difficulty grows in parallel. Level 1 draws from three-letter staples like SOS, CQ and KEY; level 2 from four-letter words such as ECHO and WAVE; level 3 from five-letter words like RELAY and MORSE; and from level 4 onward you send two-word phrases such as SEND HELP and ROGER OUT, which is where the 7-unit word gap finally matters. Each level’s word is picked from its own seeded random draw, so a given seed always produces the same sequence of words.',
      ],
    },
    {
      heading: 'Scoring',
      paragraphs: [
        'The score rewards consistency more than raw speed, because consistency is the actual skill. The constants are small and deliberately readable:',
      ],
      list: [
        'Each correct symbol is worth 10 points, multiplied by your combo multiplier if it was clean.',
        'Each correctly delimited letter adds 40 points times the multiplier, but only if every symbol in it was clean.',
        'The multiplier rises by 1 for every 5 consecutive clean symbols or letters, capped at 5×.',
        'Finishing a word adds 200 × the level, plus a 150-point bonus if the word had no mistakes at all.',
        'Any mistake, including a correct letter followed by the wrong-length gap, resets the combo to zero.',
      ],
    },
    {
      heading: 'Rules we changed after the first build',
      paragraphs: [
        'Morse Relay arrived in our sixteenth batch of original games, alongside Strata and Bankshot. The engine landed first, and the tests and interface had to be finished separately before it could ship. Building the rest of the game against an engine nobody was allowed to rewrite turned out to be a useful discipline: every behavior had to be explained by the engine’s own rules, not patched over in the UI.',
        'One subtlety that the engine handles explicitly is easy to miss in play. When you press the key during a short gap inside a letter, nothing is resolved yet. A naive reducer would carry forward the event from the previous release, so the interface could flash a second “symbol OK” for a press that had not been judged. The engine instead reports “nothing happened” for any press that resolves nothing, and a dedicated test pins that case down. The engine file also needed a small type fix during integration, a TypeScript narrowing issue that did not change behavior but would have broken the build.',
        'The bigger change came in October, when we added one-to-one challenge links. After a run you can type a name and share a link; the friend who opens it plays the exact same seed, so the same words in the same order, and sees “You beat them”, a tie, or how close they came as a percentage. Our first version of this feature also saved the friend’s score as a personal best and submitted it to the weekly leaderboard. Review flagged the problem: a fixed seed is farmable. If anyone can replay a known sequence of words as often as they like, a leaderboard built on it stops meaning anything. Challenge runs now never write to your best score or the leaderboard, and the banner says so in plain words: “Challenge runs don’t count toward your best.” In the same change we added a ten-second cooldown on score submissions, keyed per player address and per game.',
      ],
    },
    {
      heading: 'Making a hold readable',
      paragraphs: [
        'Duration is invisible, so the key itself has to show it. While you hold, a bar fills across the key, and once the game has your unit it draws a thin line at the 2-unit mark. Cross the line and you have a dash. The bar spans 6 units, which leaves room to see a dash land comfortably past the line without the bar maxing out instantly.',
        'The hint text changes with state. Before your first press it tells you that the game learns your speed from that press; after that it switches to the three gap lengths. The key works with the spacebar, a mouse, or a finger, and it captures the pointer so sliding off the button counts as releasing it rather than leaving a stuck key. Under reduced-motion settings the pulsing on the current letter is turned off.',
      ],
    },
    {
      heading: 'What we have not solved yet',
      paragraphs: [
        'Calibrating from a single press is generous but noisy. A nervous first dot that runs long makes the whole word slower, and a twitchy one makes the word unforgivingly fast. Averaging over the first few symbols would be steadier, but it would also take away the property we like most: that the first press is always right. We have kept the simple rule for now.',
        'The word lists are short, six entries per bucket, and level 4 and beyond keeps drawing two-word phrases from the same pool. Longer runs will start to repeat. Expanding the vocabulary, and possibly adding numbers and punctuation for players who know them, is the obvious next step.',
        'Finally, Morse Relay is the game we picked to introduce the site to new players, because it can be explained in one sentence and produces a number people like to compare: words per minute. The challenge links exist for the same reason. Whether that comparison loop actually brings people back is the thing we are watching next, and it is measured separately from the leaderboard on purpose.',
      ],
    },
  ],
}
