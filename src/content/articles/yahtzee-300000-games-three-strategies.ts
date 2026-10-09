import type { Article } from '../types'

export const article: Article = {
  slug: 'yahtzee-300000-games-three-strategies',
  title: 'We Played 300,000 Games of Yahtzee With Three Bots. Here Is What Actually Scores.',
  description:
    'Three Yahtzee bots, 100,000 games each, run on our own dice engine: rerolling is worth ~48 points, chasing straights ~58 more. Full numbers inside.',
  published: '2026-10-09',
  kind: 'data',
  relatedGames: ['yahtzee'],
  sections: [
    {
      heading: 'Why we did this',
      paragraphs: [
        'Most Yahtzee advice is either folklore ("always go for the upper bonus") or the output of a mathematically optimal solver that no human can follow at the table. We wanted something in between: simple, explainable strategies a person could actually use, measured on the exact rules our Yahtzee game uses.',
        'So we took the scoring engine that runs our Yahtzee page, wrote three small bots on top of it, and let each one play 100,000 complete games. Every dice roll came from the same seeded random number generator the game itself uses, so anyone with the source can rerun the experiment and get identical numbers.',
      ],
    },
    {
      heading: 'The rules these numbers apply to',
      paragraphs: [
        'Our game follows the standard 13-box scorecard: six upper boxes (ones through sixes), a +35 bonus once the upper boxes add up to 63, and seven lower boxes. Three of a Kind, Four of a Kind and Chance score the sum of all dice; Full House is 25, Small Straight 30, Large Straight 40, and Yahtzee 50. A second Yahtzee scored while the Yahtzee box already holds 50 earns a +100 bonus.',
        'Two details matter for comparing with other sites. First, our engine does not count five of a kind as a Full House. Second, there is no "joker" rule that lets an extra Yahtzee be used as a straight. Both make Yahtzees slightly less flexible than in some house rules, so scores elsewhere may differ a little.',
      ],
    },
    {
      heading: 'The three bots',
      paragraphs: [
        'Each bot is deliberately short: the whole experiment, including all three strategies and the statistics, is under 200 lines of code. None of them looks ahead more than one turn.',
      ],
      list: [
        'One roll, best box: rolls once per turn, never rerolls, and writes the result into whichever open box scores the most right now. This is the "no strategy at all" baseline.',
        'Chase of-a-kind: uses all three rolls, always keeping every die that shows the most common face (ties go to the higher face), then takes whichever open box scores the most.',
        'Situational heuristic: stops early when it already has a Yahtzee, Large Straight or (once Yahtzee is filled) a Full House; holds a run of three or more consecutive faces when a straight box is still open and it has no pair worth keeping; otherwise chases the most common face. When choosing a box, it compares each score against a rough "par" for that box, and adds 35 points of value if a box would push the upper section over 63.',
      ],
    },
    {
      heading: 'Headline result: two cheap habits are worth over 100 points',
      paragraphs: [
        'Across 100,000 games each, the one-roll bot averaged 111.3 points, the of-a-kind chaser averaged 158.8, and the situational bot averaged 216.7. The gap between the baseline and the best bot is 105.4 points per game, and it comes from two habits that need no arithmetic: use your rerolls, and know when to chase a straight instead of a set.',
        'Rerolling alone, with the crudest possible rule, added 47.5 points to the average. Adding a straight-aware hold rule and a slightly smarter box choice added another 57.9. In other words, the second habit was worth more than the first.',
        'The best bot is also the most consistent at the bottom end. Its worst game in 100,000 was 69 and its 10th percentile was 155, while the chaser had a 10th percentile of just 99. It reached 200 points in 55.2% of games, against 16.2% for the chaser and 0.1% for the one-roll bot.',
      ],
    },
    {
      heading: 'Where the points come from',
      paragraphs: [
        'The box-by-box averages tell the real story. The of-a-kind chaser is very good at the boxes it is built for: it filled the Yahtzee box with 50 in 45.6% of games and averaged 22.8 points there, the highest of the three bots. But it almost never makes a Large Straight (0.2% of games, an average of 0.1 points) and its Small Straight average is only 7.4. Between the two straight boxes it averages 7.5 points against the situational bot\'s 63.1, giving up about 55 points of straights in exchange for a few extra Yahtzees.',
        'The situational bot gives a little of that Yahtzee rate back (39.8% of games) but scores the Large Straight in 83.7% of games and averages 29.6 in Small Straight. Straights are fixed-value boxes worth 30 and 40 points, and with three rolls they are much easier to complete than most players assume, as long as you are willing to break up a pair to go for them.',
        'Full House improves steadily with skill: 34.4% of games for the one-roll bot, 65.6% for the chaser, 70.4% for the situational bot. Zeroed-out boxes fall in the same order, from an average of 4.12 per game to 3.66 and then 2.37.',
      ],
    },
    {
      heading: 'The upper bonus is harder than it looks',
      paragraphs: [
        'The most surprising number in the whole run is how rarely any bot earned the +35 upper bonus. The one-roll bot never did in 100,000 games. The chaser got it in 2.6% of games and the situational bot in 6.7%. Average upper-section totals were 31.7, 42.0 and 42.7, well short of the 63 needed.',
        'Reaching 63 essentially requires three of each face, and none of these bots is willing to spend a turn hunting for, say, three fours when something else scores more right now. That is exactly the trade-off the upper bonus is designed to test. Our takeaway is not that the bonus is unreachable — none of these bots chooses which dice to hold with the bonus in mind — but that you will not get it by accident. If you want it, you have to plan for it from the first few turns, and treat a pair of low numbers in the upper section as a real cost, not a free dump.',
      ],
    },
    {
      heading: 'What this means when you play',
      paragraphs: [
        'If you only remember three things from 300,000 simulated games, make them these:',
      ],
      list: [
        'Always use your rerolls unless you have already made a fixed-value box you still need. The crudest reroll rule beat no rerolling by 47.5 points.',
        'When a straight box is open and your roll shows three or four consecutive faces with no strong pair, hold the run. The bot that did this scored the Large Straight in 83.7% of games; the bot that never did scored it in 0.2%.',
        'Do not dump bad rolls into the upper section without thinking. Every few points below three-of-a-face makes the 63 threshold harder, and in our runs the bonus was rare even for the best bot.',
      ],
    },
    {
      heading: 'Limitations',
      paragraphs: [
        'These bots are simple on purpose, and they are not optimal. They never plan more than one turn ahead, they do not weigh the probability of finishing a combination before choosing which dice to hold, and the "par" values used by the situational bot were set by hand rather than fitted. A full dynamic-programming solver would score noticeably higher than any of them; the point here was to measure strategies a person can actually follow.',
        'Results describe our engine and our rules (no joker rule, five of a kind is not a Full House). Every game used a fixed seed, so each bot faced the same 100,000 seeds, but because the bots hold different dice they consume random numbers differently and do not see identical rolls after the first one. With 100,000 games per bot and standard deviations of 28.6 to 62.2 points, the differences between averages are far larger than sampling noise.',
      ],
    },
  ],
  tables: [
    {
      caption: 'Final scores, 100,000 games per bot on our Yahtzee engine',
      columns: ['Bot', 'Mean', 'Std. dev.', '10th pct', 'Median', '90th pct', 'Best game', 'Score ≥ 200', 'Score ≥ 300'],
      rows: [
        ['One roll, best box', '111.3', '28.6', '76', '109', '150', '248', '0.1%', '0.0%'],
        ['Chase of-a-kind', '158.8', '62.2', '99', '145', '253', '646', '16.2%', '3.6%'],
        ['Situational heuristic', '216.7', '61.0', '155', '205', '285', '722', '55.2%', '9.2%'],
      ],
    },
    {
      caption: 'How often each bot filled key boxes (share of 100,000 games)',
      columns: ['Bot', 'Upper bonus', 'Yahtzee (50)', 'Large Straight', 'Full House', 'Zero boxes per game'],
      rows: [
        ['One roll, best box', '0.0%', '1.0%', '31.3%', '34.4%', '4.12'],
        ['Chase of-a-kind', '2.6%', '45.6%', '0.2%', '65.6%', '3.66'],
        ['Situational heuristic', '6.7%', '39.8%', '83.7%', '70.4%', '2.37'],
      ],
    },
    {
      caption: 'Average points per box (100,000 games per bot)',
      columns: ['Box', 'One roll', 'Chase of-a-kind', 'Situational'],
      rows: [
        ['Ones', '1.1', '1.2', '1.5'],
        ['Twos', '2.9', '3.5', '3.7'],
        ['Threes', '4.7', '5.7', '6.0'],
        ['Fours', '6.4', '8.0', '8.2'],
        ['Fives', '7.7', '10.4', '10.7'],
        ['Sixes', '8.9', '13.2', '12.6'],
        ['Three of a Kind', '15.0', '18.9', '21.6'],
        ['Four of a Kind', '1.8', '17.2', '18.2'],
        ['Full House', '8.6', '16.4', '17.6'],
        ['Small Straight', '23.7', '7.4', '29.6'],
        ['Large Straight', '12.5', '0.1', '33.5'],
        ['Yahtzee', '0.5', '22.8', '19.9'],
        ['Chance', '17.5', '18.9', '21.3'],
      ],
    },
  ],
}
