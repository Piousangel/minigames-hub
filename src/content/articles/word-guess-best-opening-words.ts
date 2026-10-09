import type { Article } from '../types'

export const article: Article = {
  slug: 'word-guess-best-opening-words',
  title: 'The Best Opening Word for My Word Guess Game, Tested Against Every Answer',
  description:
    'I scored all 1,605 accepted guesses against all 615 Word Guess answers, then played full games. IRATE wins round one; SLATE wins the game.',
  published: '2026-10-09',
  kind: 'data',
  relatedGames: ['word-guess'],
  sections: [
    {
      heading: 'A question with a real answer',
      paragraphs: [
        'Every Wordle-style game invites the same argument: what is the best first word? The honest answer is that it depends on the word list. Lists of "best starters" published elsewhere are computed against a different set of possible answers, and some of the famous ones are not even accepted as guesses in other games.',
        'The Word Guess game on this site ships its word list in the page itself: 615 possible answers, plus extra words that are accepted as guesses but never chosen as the answer, for 1,605 accepted guesses in total. Because the list is fixed and small, I can test every possible first guess against every possible answer exhaustively. No sampling, no estimates.',
      ],
    },
    {
      heading: 'How I measured it',
      paragraphs: [
        'I used the game\'s own scoring function, including its handling of repeated letters, to compute the green/yellow/grey pattern for every pair of (guess, answer). That is 1,605 × 615, just under a million patterns. For each opening word I then asked: after seeing the colours, how many answers are still possible, on average? Lower is better. I also counted how many distinct colour patterns the word can produce and how bad its worst case is.',
        'A good first round does not guarantee a good game, so I also played complete games through the real game logic, once for every one of the 615 answers, using three different "players":',
      ],
      list: [
        'Greedy (any word): after the opener, always guesses whichever accepted word leaves the fewest answers on average, even if that word cannot itself be the answer.',
        'Greedy (possible answers only): the same idea, but it only guesses words that still fit every clue — the way "hard mode" works in many word games.',
        'Random consistent word: guesses a random word that fits every clue so far. This is my stand-in for a casual player who uses the clues correctly but does not optimise. Because it is random, it played each answer 20 times with fixed seeds, for 12,300 games per opener.',
      ],
    },
    {
      heading: 'Round one: IRATE leaves the fewest answers',
      paragraphs: [
        'Against my list, IRATE is the strongest single first guess. On average it leaves 12.7 possible answers after one turn, it can produce 103 different colour patterns, and even in its worst case only 27 answers remain. ARISE (13.6), STARE (14.0), RAISE (14.3) and CRATE (14.4) complete the top five.',
        'The pattern is clear from the letter counts. In my answer list, E appears in 51% of answers, A in 41%, R in 40%, T in 38%, S in 31%, then O at 30% and I at 29%. Every top-ten opener is built almost entirely from those letters, and none of them repeats a letter.',
        'At the other end, MUMMY is the worst accepted opener: it leaves 277.5 answers on average and 405 in its worst case. JIFFY (230.5) and WOOZY (221.0) are close behind.',
      ],
    },
    {
      heading: 'What about the famous starters?',
      paragraphs: [
        'Several words you will see recommended online do well here too. STARE ranks 3rd of 1,605, ARISE 2nd, RAISE 4th, CRATE 5th, TRACE 6th and SLATE 7th. CRANE, a popular choice, ranks 18th, leaving 17.4 answers on average.',
        'Two common "vowel-heavy" picks do much worse. ADIEU ranks 356th (32.8 answers left on average) and AUDIO ranks 978th (53.9). Vowels feel informative, but in my list U and D are rare, and O appears in fewer answers than R, T or S. Spending three of your five letters on vowels gives up the consonants that actually split the list.',
        'Three words that solver enthusiasts like — SALET, ROATE and SOARE — are not accepted by my game at all, so there is no point typing them.',
      ],
    },
    {
      heading: 'Full games: the opener matters less than you think',
      paragraphs: [
        'Here is the twist. When the greedy bot played full games, SLATE had the best average (2.98 guesses), followed by STARE (2.99), CRANE (3.00), IRATE (3.01) and ARISE (3.03). The best first-round word was not the best whole-game word, and the spread across the top five is only 0.05 guesses per game. All five solved all 615 answers within six guesses.',
        'For the casual "random consistent word" player the ranking was similar: SLATE averaged 3.17 guesses across 12,300 games, STARE 3.19, IRATE 3.21, CRANE 3.23 and ARISE 3.28, each with a win rate of 99.8% or better.',
        'The real cost shows up with weak openers. AUDIO pushed the casual player to 3.50 guesses and a 99.4% win rate; MUMMY, the worst word I could find, pushed it to 3.94 guesses and 99.6%. Even with the greedy bot, MUMMY cost about 0.6 guesses per game compared with SLATE (3.60 against 2.98).',
      ],
    },
    {
      heading: 'Your second guess is worth more than your first',
      paragraphs: [
        'Comparing bots is more revealing than comparing openers. With SLATE as the opener, a casual player who guesses any word that fits the clues averaged 3.17 guesses; the greedy bot averaged 2.98. With AUDIO, the gap was 3.50 against 3.25. The difference between playing guess two and three well and playing them casually is larger than the difference between any two good openers.',
        'The hard-mode-style greedy bot, which may only guess words that could still be the answer, sits in between: 3.01 guesses with SLATE, but it needed five or six guesses on 10 of the 615 answers, against none for the unrestricted greedy bot. Being allowed to "waste" a guess on a word that cannot be the answer but tests several new letters is a genuine advantage when many similar words remain.',
      ],
    },
    {
      heading: 'Practical advice',
      paragraphs: ['If you play Word Guess on this site:'],
      list: [
        'Open with SLATE, STARE or IRATE. Five different letters drawn mostly from E, A, R, T, S, I and L put you within a few hundredths of a guess of the best result I found.',
        'Skip vowel-dump openers like AUDIO and ADIEU. In full games AUDIO cost 0.26 to 0.33 extra guesses per game compared with SLATE, depending on the bot.',
        'If many answers still fit after two guesses, consider a third guess that tests several untried letters, even if it cannot be the answer.',
      ],
    },
    {
      heading: 'Limitations',
      paragraphs: [
        'These results apply to the word list my Word Guess game uses today: 615 answers and 1,605 accepted guesses. A different list (including the official Wordle list) will give different rankings. My greedy bots minimise the expected number of remaining answers one step at a time; they are strong but not provably optimal, and a full game-tree search could shave a little more off the averages. The casual-player bot is a simplification — real people do not choose uniformly among fitting words. Win rates are high partly because the answer list is relatively small and common-word based.',
      ],
    },
  ],
  tables: [
    {
      caption: 'Top 10 first guesses against all 615 answers (exhaustive)',
      columns: ['Rank', 'Word', 'Avg. answers left', 'Distinct patterns', 'Worst case'],
      rows: [
        ['1', 'IRATE', '12.7', '103', '27'],
        ['2', 'ARISE', '13.6', '95', '32'],
        ['3', 'STARE', '14.0', '113', '37'],
        ['4', 'RAISE', '14.3', '96', '32'],
        ['5', 'CRATE', '14.4', '116', '36'],
        ['6', 'TRACE', '14.5', '119', '40'],
        ['7', 'SLATE', '15.2', '110', '39'],
        ['8', 'SNARE', '15.5', '96', '42'],
        ['9', 'ALERT', '15.6', '105', '39'],
        ['10', 'TRADE', '15.6', '105', '43'],
      ],
    },
    {
      caption: 'Popular openers ranked among all 1,605 accepted guesses',
      columns: ['Word', 'Rank', 'Avg. answers left', 'Worst case'],
      rows: [
        ['ARISE', '2', '13.6', '32'],
        ['STARE', '3', '14.0', '37'],
        ['CRATE', '5', '14.4', '36'],
        ['SLATE', '7', '15.2', '39'],
        ['CRANE', '18', '17.4', '46'],
        ['ADIEU', '356', '32.8', '67'],
        ['AUDIO', '978', '53.9', '121'],
        ['SALET / ROATE / SOARE', 'Not accepted', '—', '—'],
      ],
    },
    {
      caption: 'Full games: average guesses to solve (win rate within 6 guesses)',
      columns: ['Opener', 'Greedy, any word (615 games)', 'Greedy, answers only (615 games)', 'Random fitting word (12,300 games)'],
      rows: [
        ['SLATE', '2.98 (100%)', '3.01 (100%)', '3.17 (99.9%)'],
        ['STARE', '2.99 (100%)', '3.01 (100%)', '3.19 (100.0%)'],
        ['CRANE', '3.00 (100%)', '3.03 (100%)', '3.23 (99.9%)'],
        ['IRATE', '3.01 (100%)', '3.04 (100%)', '3.21 (99.8%)'],
        ['ARISE', '3.03 (100%)', '3.08 (100%)', '3.28 (99.9%)'],
        ['AUDIO', '3.25 (100%)', '3.27 (99.8%)', '3.50 (99.4%)'],
        ['MUMMY', '3.60 (100%)', '3.61 (99.8%)', '3.94 (99.6%)'],
      ],
    },
  ],
}
