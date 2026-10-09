import type { GameGuide } from '../types'

export const guide: GameGuide = {
  slug: 'minesweeper',
  title: 'Minesweeper Strategy: Where to Click First and How Often You Must Guess',
  description:
    'I played 15,000 boards of this site’s 9x9 Minesweeper with a logic solver. Where your first click should go, how often a guess is forced, and how to guess well.',
  updated: '2026-10-09',
  sections: [
    {
      heading: 'How this board is actually built',
      paragraphs: [
        "The Minesweeper here is a single fixed format: a 9x9 grid holding exactly 10 mines, so roughly one square in eight is dangerous. Nothing is placed when the page loads. The mines are dropped the moment you make your first reveal, chosen uniformly at random from every square except the one you clicked. That is the whole of the first-click protection.",
        "The detail matters because many desktop versions of the game clear a 3x3 safe zone around the first click, which guarantees an opening. This one does not. Your first square is always safe, but its eight neighbours are fair game, so the first click can just as easily show a lone 2 as blow open half the board. Knowing that changes where you should click, which is the first thing worth getting right.",
      ],
    },
    {
      heading: 'Corner, edge or centre: the first click, measured',
      paragraphs: [
        "To see how much the first square matters, I ran the real game engine through 5,000 boards for each of three opening squares: the top-left corner, the middle of the top edge, and the exact centre. The result is lopsided. A corner click landed on a zero, and therefore triggered an automatic opening, in 67.2% of boards. The edge managed 49.8%, and the centre only 31.4%. Those match the exact odds you get by counting: a corner has 3 neighbours that must all be mine-free, an edge square 5, and a centre square 8, which works out to 66.6%, 50.3% and 32.6%.",
        "On average a corner start left 19.0 squares uncovered after one click, the edge 18.4 and the centre 14.9. The centre does open larger areas when it hits a zero, but it misses so often that the average still trails. If you want to see the board quickly, click a corner.",
      ],
      list: [
        'Corner start: opens an area 67.2% of the time (5,000 boards).',
        'Edge start: 49.8% (5,000 boards).',
        'Centre start: 31.4% (5,000 boards).',
      ],
    },
    {
      heading: 'How often a guess is unavoidable',
      paragraphs: [
        "Every Minesweeper player eventually meets a position where no amount of thinking helps. To measure how common that is here, I used a solver that does the logic perfectly. At every step it enumerates every arrangement of mines consistent with the visible numbers and the total of 10, and it only reveals a square that is safe in all of them. When no such square exists, it is forced to guess, and it picks the square with the lowest mine probability.",
        "From a corner start, that solver cleared 55.0% of boards without a single guess. From the edge the figure fell to 45.3%, and from the centre to 28.7%. So on this board a forced guess is not an occasional bad break: from the best opening it shows up in close to half your games, and from the centre in more than seven out of ten. Overall the solver won 90.6% of corner-start games, 88.3% from the edge and 84.7% from the centre. When it had to guess at least once, it still won about 79% of the time.",
        "The practical lesson is to stop reading a forced 50/50 as your own failure. Over a session, the only things you control are whether you missed a deduction and whether you guessed well when the board ran out of logic.",
      ],
    },
    {
      heading: 'Use the mine counter, not just the numbers',
      paragraphs: [
        "With only 10 mines on 81 squares, the global count is unusually powerful in the late game. My solver relies on it heavily, and you can too. When the remaining unknown squares are split into a few separate pockets, add up the minimum each pocket must contain. If that already equals the mines left, every square that is not next to a number is safe, even though no single number says so.",
        "The counter shows 10 minus your flags. It counts flags, not real mines, so it is only reliable if your flags are correct. One careless flag throws it off for the rest of the game. Flag only what you have proven.",
      ],
    },
    {
      heading: 'When you must guess, guess away from the numbers',
      paragraphs: [
        "Guessing well is mostly arithmetic. A square in the open interior, touching no revealed number, has a mine chance of roughly the mines not yet accounted for divided by the interior squares left. Early in a game that is often around one in eight or lower. A square next to a 1 that touches three unknowns is closer to one in three. The solver's lowest-risk guesses were very often interior squares for exactly this reason, and an interior square that turns out safe frequently opens a fresh area.",
        "Two more habits help. First, if a guess is unavoidable, take it as early as you can. You lose the same amount whenever it fails, but failing early costs less time. Second, when two candidate squares are about equally risky, choose the one whose reveal would settle the most other squares, such as a square that would split a long ambiguous border in two.",
      ],
      list: [
        'Interior square: about (mines left minus mines pinned on the border) divided by interior squares left.',
        'Border square: roughly the number divided by the unknown squares it touches, adjusted for overlaps.',
        'A true 50/50 in a closed pocket will not improve, so resolve it first and move on.',
      ],
    },
    {
      heading: 'Controls in this version, and what they mean for speed',
      paragraphs: [
        "This build has no chording. Clicking a number that already touches enough flags does nothing, because the engine ignores clicks on revealed squares. Every safe square has to be opened with its own click. That changes the economics of flagging. You win the moment every non-mine square is revealed, and flags play no part in that check. Flags exist purely as notes to yourself.",
        "For a fast clear, flag only where a flag stops you misclicking in a dense corner, and otherwise skip them. The timer starts on your first reveal, not when the board appears, and only a win records a best time, so take a moment to plan before the first click. On a phone, the Flag toggle switches every tap into flag mode until you turn it off. Many lost mobile games come from forgetting it is still on, or off.",
      ],
    },
    {
      heading: 'A short routine for consistent clears',
      paragraphs: [
        "Put the pieces together and a reliable game looks like this. Open in a corner. Sweep the edge of the opening for the easy cases, where a number already touches its full count of flagged or certain mines, or where its unknown neighbours exactly equal its number. Then work the overlaps between neighbouring numbers. Before any guess, do one deliberate scan of the whole border and one check of the mine counter. Only then choose the lowest-risk square, which is usually an interior one.",
        "Following that routine will not lift your win rate to 100%, because my solver shows that is impossible on this board. What it does is close the gap between your results and the roughly 90% that perfect play reaches from a corner.",
      ],
    },
  ],
}
