export const guide = {
  slug: 'overfold',
  title: 'Overfold Strategy: Clearing Is Easy, Scoring Is the Puzzle',
  description:
    'An exhaustive search of 5,000 Overfold boards shows jams clear pips too, par is never the minimum, and the real skill is combo seals inside par.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'What we measured, and how',
      paragraphs: [
        'Overfold boards are small enough to solve completely by computer, so instead of guessing at strategy we searched every possible fold sequence. The script (scripts/content-sims/overfold.ts in this site\'s repository) generates boards with the game\'s real generator, 1,000 per level for levels 1 to 5, and replays every legal fold through the game\'s own fold-preview function. Level 5 is the last level whose rules change: from there on every board is built from up to seven folds, so the level 5 figures describe every later level too.',
        'The results overturn the most common assumption about the game — that the challenge is getting the board cleared. It almost never is.',
      ],
    },
    {
      heading: 'The full rulebook in one place',
      paragraphs: [
        'Tapping a crease folds the smaller side of the paper over the larger one, and each folded cell lands on its mirror image. What happens depends on the two cells that meet:',
      ],
      list: [
        'Same colour on same colour: a seal. Both pips disappear and you score.',
        'A pip onto an empty cell: the pip simply moves across.',
        'Two different colours: they fuse into a jam, a permanent dead cell.',
        'A pip folded onto a jam: the pip is destroyed and the jam remains. A jam folded onto a pip destroys that pip the same way.',
        'An empty cell folded onto anything: no change.',
        'Seals in a single fold score on a rising scale: 1 seal is 10 points, 2 is 30, 3 is 60, 4 is 100.',
        'Finishing at or under par adds a 200-point bonus. You have a hard budget of par + 3 folds, and three Unfolds per board.',
        'The board is cleared when no pips remain — however they were removed. It is lost if the budget runs out, or the paper shrinks to a single cell, while pips remain.',
      ],
    },
    {
      heading: 'Why you will almost always clear the board',
      paragraphs: [
        'Read the last rule again. The game does not ask whether every pip was sealed, only whether any pip is left. Because jams swallow pips that land on them, sloppy folding removes pips too. The search measured what happens to a player who taps random creases every turn: they cleared 100% of boards on levels 1 to 3 and 99.9% on levels 4 and 5.',
        'So the board is not the opponent. The score is. A random tapper\'s expected score was between 141 and 176 points depending on level, while careful play reaches 220 to 268. Almost all of that gap is the par bonus and the seal combos — the two things this guide focuses on.',
      ],
    },
    {
      heading: 'Par is generous — never once was it the true minimum',
      paragraphs: [
        'Every board is built by unfolding a blank sheet a fixed number of times, and par is simply how many unfolds the generator used: 3 at level 1, rising by one per level to 7. Not every unfold plants a new pair of pips, though, so the shortest solution is usually shorter than par. In every one of the 5,000 boards searched, a solution existed that sealed every pip, formed no jam at all, and still used fewer folds than par.',
      ],
      list: [
        'Level 1: par 3; shortest jam-free clear averaged 2.00 folds.',
        'Level 2: par 4; jam-free 2.90 folds.',
        'Level 3: par 5; jam-free 3.90 folds.',
        'Level 4: par 6; jam-free 4.87 folds.',
        'Level 5 and beyond: par averaged 6.82 (the paper cannot always grow seven times within the 6x6 limit); jam-free 5.60 folds.',
      ],
    },
    {
      heading: 'Jamming is the fastest finish, and the worst score',
      paragraphs: [
        'If you only want the board gone, deliberately crashing colours together is often quickest. Allowing jams, the absolute shortest clear averaged 1.98 folds at level 1 but just 3.40 at level 5. Jamming gave a strictly shorter route than any clean one on 2.3% of level 1 boards, 12.0% at level 2, 80.7% at level 3, 96.7% at level 4 and 99.1% at level 5.',
        'That shortcut is worth nothing on its own, because there is no bonus for finishing well under par — 200 points is the same whether you use one fold or par. Every jam destroys pips that could have been seals. The only time a deliberate jam makes sense is when you are about to run out of folds and need the par bonus more than the last 10 or 30 points of seals.',
      ],
    },
    {
      heading: 'Where the extra points are: combo folds',
      paragraphs: [
        'Since par is easy to beat, the scoring ceiling comes from seals, and the rising scale makes it all about doubling up. Two separate single seals earn 20 points; the same two seals in one fold earn 30. Four in one fold earn 100, where four single folds would earn 40.',
        'The search compared two ways of playing every board. Replaying the generator\'s own solution — one seal per fold, finishing exactly on par — scored 220 at level 1 rising to 257 at level 5, with the 200 bonus included. The best possible line found by exhaustive search scored 222 at level 1 and 268 at level 5. The best line beat the generator\'s solution on 20.2% of level 1 boards, 43.7% at level 2, 68.7% at level 3, 78.8% at level 4 and 85.2% at level 5. On the harder levels, finding a combo is the norm, not a lucky extra.',
        'The best way to find combos is to use the fold preview. Hovering a crease with a mouse, or moving the keyboard cursor onto it with the arrow keys, shows which cells would seal and which would jam before you commit. On a touchscreen a tap folds immediately, so there you have to trace the mirror images by eye. Check every crease before each fold — it costs nothing — and pick the one with the most seals that does not jam a pip you still need.',
      ],
    },
    {
      heading: 'Safety nets: Unfold, the budget, and even creases',
      paragraphs: [
        'Mistakes are cheap to explore. On a fresh board the search found that every legal first fold still left a win within the budget, on every one of the 5,000 boards. That means your first move cannot lose the board, though it can cost you a combo.',
        'Unfold (the button or the U key) restores the board, the fold count and the score exactly as they were, but you get only three per board and they are not refunded. Treat them as a way to test a combo idea, not to undo every fold.',
        'When a crease splits the paper exactly in half, a tap always folds the left or top half. With a keyboard, Shift+Enter folds the right or bottom half instead. The two results are mirror images with identical seals and jams, so the choice only matters if you find the mirrored layout easier to read.',
      ],
      list: [
        'In a run, your score carries over from one board to the next as the levels climb. Retrying a board starts it, and the run score, from zero again.',
        'In Daily mode every player gets the same boards, generated from the UTC date; the game remembers your best score and fewest folds for the day.',
      ],
    },
  ],
}
