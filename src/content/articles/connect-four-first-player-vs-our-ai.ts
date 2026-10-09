import type { Article } from '../types'

export const article: Article = {
  slug: 'connect-four-first-player-vs-our-ai',
  title: 'Does Going First Win at Connect Four? 114,000 Bot Games Against My AI',
  description:
    'I pitted four bots against my Connect Four AI. Random play never won in 2,000 games; one safety rule raised it to 13.9%. And the AI does better going second.',
  published: '2026-10-09',
  kind: 'data',
  relatedGames: ['connect-four'],
  sections: [
    {
      heading: 'The question',
      paragraphs: [
        'Connect Four is one of the few popular games that has been solved: with perfect play, the player who moves first and starts in the centre column can always force a win. That is a statement about perfect players, though. On the Connect Four page here you always move first, as Red, against a computer opponent playing Yellow. So the more useful question is: how much does going first actually help against the AI you will really face, and what kind of play is needed to beat it?',
        'To find out, I ran bots against the exact move-selection code that powers my game, through the same board engine, for a total of 114,000 games.',
      ],
    },
    {
      heading: 'What my AI does',
      paragraphs: [
        'The game has two difficulty settings. Easy picks a random legal column. Hard, the default, follows three steps: take an immediate win if one exists; otherwise block the opponent\'s immediate win; otherwise run a five-move-deep minimax search with alpha-beta pruning, scoring positions by counting open lines of two and three discs and favouring the centre column. When several columns score equally it picks one of them at random.',
        'Five moves deep is enough to see most short tactics, but not the long-range "which row will this threat eventually land on" planning that decides games between strong players.',
      ],
    },
    {
      heading: 'The bots',
      paragraphs: [
        'All randomness — the bots\' choices and the AI\'s tie-breaks — came from a fixed-seed generator in my internal simulation script, so the numbers below are stable from run to run. I also recorded how many distinct games (different move sequences) each matchup produced, because a deterministic bot can end up replaying the same game thousands of times.',
      ],
      list: [
        'Random: picks any legal column. This is exactly what my Easy AI does.',
        'Win/block/center: takes an immediate win, blocks an immediate loss, otherwise plays the legal column closest to the centre. This is roughly how many casual players think.',
        'Win/block/safe-center: the same, plus one extra rule — it avoids any move that lets the opponent win immediately by playing on top of it. If several moves are safe it prefers the most central, with a 25% chance of taking the second-most central to keep games varied.',
        'Site AI (hard): my real Hard opponent, used on either side of the board.',
      ],
    },
    {
      heading: 'Between equal random players, going first is worth about 11 points',
      paragraphs: [
        'I started with the baseline: 100,000 games of random against random, which is the same as Easy AI against Easy AI. The first player won 55.5%, the second 44.2%, and 0.3% were draws. Games lasted 21.3 discs on average, and 99,875 of the 100,000 games were distinct. So even with no skill at all on either side, moving first gave an edge of about 11 percentage points.',
        'The simple win/block/center bot playing against itself shows how fragile rules of thumb are. Because it is fully deterministic, all 2,000 games were the same game: the first player won in 15 discs, every time. A rule like "always play near the centre" can be exploited perfectly once someone sees the pattern.',
      ],
    },
    {
      heading: 'Against the Hard AI, going first is not enough',
      paragraphs: [
        'Moving first against my Hard AI, the random bot lost all 2,000 games, usually quickly: an average of 12.6 discs per game. The win/block/center bot also lost all 2,000. Its games lasted longer (20.0 discs on average), but the AI\'s random tie-breaks only produced 4 different games in total — and the bot lost every one of them.',
        'The single extra safety rule changed the picture. The win/block/safe-center bot, still moving first, won 13.9% of its 2,000 games, drew 6.2% and lost 79.9%, with games stretching to 30.5 discs on average across 1,172 distinct games. The only difference from the bot that never won is one question asked before every move: "if I play here, can my opponent win by playing directly on top?" That is the most valuable habit I found.',
      ],
    },
    {
      heading: 'The surprise: my AI is stronger going second',
      paragraphs: [
        'I then flipped the seats and let the Hard AI move first. Against random play it won all 2,000 games, in just 10.2 discs on average. Against the safe-center bot it won 60.3%, drew 22.3% and lost 17.4%. Put the two seatings side by side and the safe-center bot actually did better as the second player (17.4% wins, 22.3% draws) than as the first player (13.9% wins, 6.2% draws).',
        'The strongest evidence comes from the AI playing itself. In 2,000 games of Hard against Hard, the first player won only 1.8%, the second player won 93.2%, and 5.0% were draws. The games were long (37.2 discs out of a possible 42) and the AI\'s tie-breaks produced 449 distinct games, so this is not one quirky line repeated; it is a consistent pattern.',
        'My best explanation, which I have not proven, is that the theoretical first-move advantage in Connect Four depends on long-term planning about which row each threat will land on, and a five-move search does not plan that far. When both sides only look five moves ahead, the board tends to fill up evenly, and the late, forced moves near the top of the board seem to favour the player who moves second. Whatever the cause, the practical lesson is clear: going first against my AI is not, by itself, an advantage you can rely on.',
      ],
    },
    {
      heading: 'How to beat my Hard AI',
      paragraphs: ['Based on these runs, these are the habits that turned zero wins into some wins:'],
      list: [
        'Before every move, check the square directly above where your disc will land. If your opponent can win there, do not play that column. This one rule took a bot from 0 wins in 2,000 to 13.9%.',
        'Do not rely on a fixed pattern. A purely predictable strategy produced only a handful of distinct games against the AI and lost all of them.',
        'Expect long games. The safe-center bot\'s games against the AI averaged 30.5 discs, against 12.6 for random play; the AI rarely falls for short tactics, so any win has to come from threats it cannot see five moves ahead.',
        'If you want an easier game, switch to Easy: it plays completely at random, and in my runs even a random first player beat it 55.5% of the time.',
      ],
    },
    {
      heading: 'Limitations',
      paragraphs: [
        'These results describe my AI as it is implemented today, with the bots described above; they are not a statement about Connect Four under perfect play. Each matchup against the Hard AI used 2,000 games, because each Hard move runs a search and the full experiment takes several minutes; the random-versus-random baseline used 100,000. Some matchups produced few distinct games because both sides are largely deterministic, and I report those counts so the percentages are not over-read. A human who mixes up their play and looks further ahead than one move should do better than my safe-center bot.',
      ],
    },
  ],
  tables: [
    {
      caption: 'Results by matchup (Red moves first — the human seat on this site)',
      columns: ['First player (Red)', 'Second player (Yellow)', 'Games', 'First wins', 'Second wins', 'Draws', 'Avg. discs', 'Distinct games'],
      rows: [
        ['Random (Easy AI)', 'Random (Easy AI)', '100,000', '55.5%', '44.2%', '0.3%', '21.3', '99,875'],
        ['Win/block/center', 'Win/block/center', '2,000', '100.0%', '0.0%', '0.0%', '15.0', '1'],
        ['Random', 'Site AI (Hard)', '2,000', '0.0%', '100.0%', '0.0%', '12.6', '1,902'],
        ['Win/block/center', 'Site AI (Hard)', '2,000', '0.0%', '100.0%', '0.0%', '20.0', '4'],
        ['Win/block/safe-center', 'Site AI (Hard)', '2,000', '13.9%', '79.9%', '6.2%', '30.5', '1,172'],
        ['Site AI (Hard)', 'Random', '2,000', '100.0%', '0.0%', '0.0%', '10.2', '1,648'],
        ['Site AI (Hard)', 'Win/block/safe-center', '2,000', '60.3%', '17.4%', '22.3%', '26.5', '1,220'],
        ['Site AI (Hard)', 'Site AI (Hard)', '2,000', '1.8%', '93.2%', '5.0%', '37.2', '449'],
      ],
    },
    {
      caption: 'The safe-center bot against my Hard AI, by seat (2,000 games each)',
      columns: ['Bot seat', 'Bot wins', 'Draws', 'Bot losses'],
      rows: [
        ['First (Red)', '13.9%', '6.2%', '79.9%'],
        ['Second (Yellow)', '17.4%', '22.3%', '60.3%'],
      ],
    },
  ],
}
