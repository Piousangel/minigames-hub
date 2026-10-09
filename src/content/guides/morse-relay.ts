export const guide = {
  slug: 'morse-relay',
  title: 'Morse Relay Timing Guide: Units, Tolerances and the First-Press Window',
  description:
    'How Morse Relay reads your timing: calibration, dot/dash and gap thresholds, tolerance per level, the combo multiplier, and what simulated keyers show.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'Your first press sets the unit for the whole word',
      paragraphs: [
        "Morse Relay has no fixed speed. At the start of every word, the game waits for your first press and works out a unit from it. If the word's first symbol is a dot, the unit is exactly how long you held the key. If it is a dash, the unit is your hold divided by three. The unit is kept between 40 and 600 milliseconds, and the WPM figure on screen is simply 1200 divided by the unit, which is the standard PARIS conversion.",
        "Two consequences follow. First, the calibration is reset for every new word, so a slow, nervous start on one word does not carry over to the next. Second, within a word everything is measured against that single press. As long as you stay inside the 40–600 ms range, your first symbol is always read as correct and clean, because it defines the yardstick, but if it was unusually long or short, every later symbol and gap in the word is judged against a skewed unit.",
      ],
    },
    {
      heading: 'The thresholds, in units',
      paragraphs: [
        "Once the unit is set, the boundaries never move. A hold of up to 2 units is a dot, and anything longer is a dash. Release times work the same way. A silence of up to 2 units means the next symbol belongs to the same letter. More than 2 and up to 5 units means a new letter. Longer than 5 units means a new word. The ideal lengths sit well inside those bands: 1 unit for a dot, 3 for a dash, and 1, 3 and 7 units for the three kinds of gap.",
        "The hold bar under the key draws a marker at the 2-unit point once you are calibrated, so you can see the dot/dash boundary while you hold. There is no such display for gaps, so they have to be counted in your head.",
      ],
      list: [
        'Hold up to 2 units: dot. Over 2 units: dash.',
        'Gap up to 2 units: same letter. 2–5 units: next letter. Over 5 units: next word.',
        'The last letter of a word finishes on its own after 2 units of silence, so there is no need to wait out a full gap.',
        'Three seconds of silence in the middle of a word forces the current letter to resolve.',
      ],
    },
    {
      heading: 'What actually costs a life',
      paragraphs: [
        "You start with five lives, and only two things take one away. The first is pressing the wrong symbol, for example a dash where the letter needs a dot. The second is pausing long enough to start a new letter before the current one is finished. That second case is the classic way to lose a life on letters like H or J: a hesitation of more than 2 units halfway through counts as ending the letter early.",
        "Getting the gap wrong between two complete letters is gentler than you might expect. Using a word gap where a letter gap belongs, or the other way round, counts as a mistake. It resets your combo and costs the word's clean bonus, but it does not cost a life, and the letter still counts as correct. After a wrong symbol, the rest of that letter is already lost and further presses can't cost more lives. The quickest recovery is to stop, rest for one letter gap, and start the next letter.",
      ],
    },
    {
      heading: 'Tolerance tightens with every word',
      paragraphs: [
        "A correct symbol is also marked clean if its length is within a tolerance of its ideal. That tolerance depends on your level, and your level goes up by one with every completed word. It is 55% on the first word, then 47%, 39%, 31% and 23%, and it bottoms out at 15% from the sixth word on. At that floor a clean dot has to fall between 0.85 and 1.15 units and a clean dash between 2.55 and 3.45. Gaps are never scored for cleanliness; only the band they land in matters.",
        "The word list changes as well. Level 1 draws from three-letter and shorter words such as SOS, CQ and KEY. Level 2 uses four-letter words, and level 3 five-letter ones like RELAY and MORSE. From level 4 onward every target is a two-word phrase, such as SEND HELP or ROGER OUT, so word gaps begin to matter at the same point the tolerance starts to bite.",
      ],
    },
    {
      heading: 'Scoring and the combo multiplier',
      paragraphs: [
        "Each correct symbol scores 10 points. If it is clean, it adds 1 to your combo and the 10 is multiplied. Completing a letter cleanly, meaning all symbols clean and followed by the right gap, adds another 1 to the combo and scores 40 times the multiplier. The multiplier is 1 plus your combo divided by 5, rounded down, and it is capped at ×5 when the combo reaches 20. A correct but sloppy symbol still scores a flat 10, but it resets the combo to zero. Finishing a word adds 200 times the level, plus 150 if the word had no mistakes.",
        "Because both clean symbols and clean letters feed the combo, a three-symbol letter keyed cleanly adds 4 to it. About five clean three-symbol letters in a row reach the ×5 cap.",
      ],
    },
    {
      heading: 'What consistency is worth: simulated keyers',
      paragraphs: [
        "We fed a model keyer into the game's real reducer. Every hold and every gap was its ideal length multiplied by a random factor with a set spread (σ), so σ = 0.10 means a typical error of about 10%. Each setting was run on 2,000 words drawn from that level's real word list. At level 1, a 10% keyer lost 0.01 lives per word and keyed 99.2% of words without a mistake. At 20% spread that fell to 66.0% mistake-free with 0.29 lives lost per word, and at 30% to 33.0% with 0.75 lives lost.",
        "Level 4, where the phrases begin, separates players sharply. The 10% keyer still finished 96.0% of words with no mistakes, while the 20% keyer lost 0.99 lives per word and the 30% keyer 2.45. At that rate, five lives last about two phrases. At level 6, even the 10% keyer kept just 71.7% of symbols clean, because the 15% band is narrow. It still lost only 0.03 lives per word, since the dot/dash and gap boundaries don't tighten with level.",
      ],
      list: [
        'Level 1, σ 0.20: 66.0% mistake-free words, 0.29 lives lost per word (2,000 words).',
        'Level 4, σ 0.20: 33.0% mistake-free, 0.99 lives lost per word (2,000 words).',
        'Level 6, σ 0.10: 95.1% mistake-free, but only 71.7% of symbols clean (2,000 words).',
      ],
    },
    {
      heading: 'How wrong can the first press be?',
      paragraphs: [
        "In a second test, the keyer was perfect except for its first press, which we stretched or shrank by a factor f, and we checked every word in each level's list. A word still went through without mistakes for f from 0.60 to 1.49 on levels 1–3. From level 4 the upper limit falls to 1.39, because a true 7-unit word gap has to stay above 5 of the inflated units. To keep every symbol clean as well, the window narrows to 0.77–1.39 at level 4, 0.82–1.29 at level 5 and 0.87–1.17 from level 6.",
        "In practice, an over-long first press is the most common way to wreck a phrase on the later levels. Make the opening symbol the most ordinary press of the word, rather than a deliberate, heavy one, and count every gap in multiples of that same press.",
      ],
    },
  ],
}
