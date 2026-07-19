/**
 * Clusters — pure engine.
 *
 * A "Connections"-style daily grouping puzzle. 16 items sit in a 4×4 grid and
 * secretly form 4 groups of 4. The player selects exactly 4 items and submits:
 * if the four are a whole group, that group locks in (revealed with its name and
 * difficulty tier). A wrong guess costs a life; when a wrong guess holds exactly
 * 3 of a single group the player is told "One away". Four mistakes = loss; all
 * four groups found = win.
 *
 * Purity: every function here is pure and total. No timers, no `Date`, and NO
 * `Math.random`. Randomness enters ONLY through an injected `Rng`, and is
 * consumed ONLY in board generation (`generateGame`). The reducer — select,
 * shuffle, submit — consumes no rng, so every outcome is golden-testable from a
 * fixed seed + a scripted sequence of guesses.
 */

export type Rng = () => number // float in [0,1)
export type Tier = 0 | 1 | 2 | 3

export interface Group {
  name: string
  items: readonly [string, string, string, string]
  tier: Tier
}

export const LIVES_START = 4
export const GROUP_SIZE = 4
export const GROUP_COUNT = 4

// -- PRNG (byte-identical to the decant template's mulberry32) ---------------

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a date string 'YYYY-MM-DD' → 32-bit unsigned seed. */
export function dailySeed(dateStr: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// -- Category bank -----------------------------------------------------------
// Widely-known, unambiguous categories. 1-2 word items. Items are kept globally
// distinct enough that any four groups chosen for a board never share an item;
// where a rare collision exists (e.g. RUBY the gem vs. RUBY the language) the
// generator's conflict guard keeps them out of the same board.

export const BANK: readonly Group[] = [
  // ── Tier 0 — easiest ──────────────────────────────────────────────────────
  { name: 'Card suits', items: ['Hearts', 'Spades', 'Clubs', 'Diamonds'], tier: 0 },
  { name: 'Compass points', items: ['North', 'South', 'East', 'West'], tier: 0 },
  { name: 'Four seasons', items: ['Spring', 'Summer', 'Autumn', 'Winter'], tier: 0 },
  { name: 'Farm animals', items: ['Cow', 'Pig', 'Horse', 'Sheep'], tier: 0 },
  { name: 'Ball sports', items: ['Soccer', 'Tennis', 'Golf', 'Cricket'], tier: 0 },
  { name: 'Common fruits', items: ['Apple', 'Banana', 'Grape', 'Mango'], tier: 0 },
  { name: 'Body parts', items: ['Arm', 'Leg', 'Head', 'Hand'], tier: 0 },
  { name: 'Daily meals', items: ['Breakfast', 'Lunch', 'Dinner', 'Brunch'], tier: 0 },
  { name: 'Basic shapes', items: ['Circle', 'Square', 'Triangle', 'Star'], tier: 0 },
  { name: 'Pet animals', items: ['Dog', 'Cat', 'Rabbit', 'Hamster'], tier: 0 },
  { name: 'Kitchen tools', items: ['Fork', 'Spoon', 'Knife', 'Plate'], tier: 0 },

  // ── Tier 1 — easy/medium ─────────────────────────────────────────────────
  { name: 'Inner planets', items: ['Mercury', 'Venus', 'Earth', 'Mars'], tier: 1 },
  { name: 'Oceans', items: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], tier: 1 },
  { name: 'Chess pieces', items: ['Pawn', 'Knight', 'Bishop', 'Rook'], tier: 1 },
  { name: 'Continents', items: ['Africa', 'Asia', 'Europe', 'Antarctica'], tier: 1 },
  { name: 'Greek letters', items: ['Alpha', 'Beta', 'Gamma', 'Delta'], tier: 1 },
  { name: 'US coins', items: ['Penny', 'Nickel', 'Dime', 'Quarter'], tier: 1 },
  { name: 'Martial arts', items: ['Karate', 'Judo', 'Kung Fu', 'Taekwondo'], tier: 1 },
  { name: 'Pizza toppings', items: ['Pepperoni', 'Mushroom', 'Onion', 'Olive'], tier: 1 },
  { name: 'Solfège notes', items: ['Do', 'Re', 'Mi', 'Fa'], tier: 1 },
  { name: 'Zodiac signs', items: ['Aries', 'Leo', 'Virgo', 'Libra'], tier: 1 },
  { name: 'Board games', items: ['Chess', 'Checkers', 'Ludo', 'Backgammon'], tier: 1 },

  // ── Tier 2 — medium/hard ─────────────────────────────────────────────────
  { name: 'Shakespeare plays', items: ['Hamlet', 'Macbeth', 'Othello', 'Tempest'], tier: 2 },
  { name: 'Programming languages', items: ['Python', 'Java', 'Rust', 'Kotlin'], tier: 2 },
  { name: 'Greek gods', items: ['Zeus', 'Hera', 'Ares', 'Apollo'], tier: 2 },
  { name: 'Constellations', items: ['Orion', 'Draco', 'Cygnus', 'Lyra'], tier: 2 },
  { name: 'Noble gases', items: ['Helium', 'Neon', 'Argon', 'Xenon'], tier: 2 },
  { name: 'Ballroom dances', items: ['Tango', 'Waltz', 'Samba', 'Foxtrot'], tier: 2 },
  { name: 'Woodwinds', items: ['Flute', 'Oboe', 'Clarinet', 'Bassoon'], tier: 2 },
  { name: 'Gemstones', items: ['Ruby', 'Emerald', 'Sapphire', 'Topaz'], tier: 2 },
  { name: 'Coffee drinks', items: ['Latte', 'Mocha', 'Espresso', 'Cappuccino'], tier: 2 },
  { name: 'Sushi types', items: ['Maki', 'Nigiri', 'Sashimi', 'Temaki'], tier: 2 },
  { name: 'Pasta shapes', items: ['Penne', 'Fusilli', 'Rigatoni', 'Farfalle'], tier: 2 },

  // ── Tier 3 — trickiest ───────────────────────────────────────────────────
  { name: 'Greek muses', items: ['Clio', 'Calliope', 'Erato', 'Thalia'], tier: 3 },
  { name: 'Norse realms', items: ['Asgard', 'Midgard', 'Helheim', 'Vanaheim'], tier: 3 },
  { name: 'SI base units', items: ['Meter', 'Second', 'Kelvin', 'Ampere'], tier: 3 },
  { name: 'Classical painters', items: ['Monet', 'Dali', 'Rembrandt', 'Vermeer'], tier: 3 },
  { name: 'Philosophers', items: ['Plato', 'Kant', 'Hume', 'Locke'], tier: 3 },
  { name: 'World currencies', items: ['Yen', 'Won', 'Peso', 'Dinar'], tier: 3 },
  { name: 'Composers', items: ['Bach', 'Mozart', 'Chopin', 'Liszt'], tier: 3 },
  { name: 'Romantic poets', items: ['Keats', 'Byron', 'Frost', 'Shelley'], tier: 3 },
  { name: 'Amino acids', items: ['Lysine', 'Glycine', 'Serine', 'Valine'], tier: 3 },
  { name: 'High peaks', items: ['Everest', 'Denali', 'Elbrus', 'Aconcagua'], tier: 3 },
  { name: 'Chess champions', items: ['Carlsen', 'Fischer', 'Kasparov', 'Tal'], tier: 3 },
]

// -- State -------------------------------------------------------------------

export type LastResult = 'none' | 'correct' | 'wrong' | 'one-away'
export type Status = 'playing' | 'won' | 'lost'

export interface ClustersState {
  seed: number
  groups: Group[] // the 4 answers, sorted by tier (easy → hard)
  tiles: string[] // unsolved items, in display order
  selected: string[] // 0..4 currently-selected items
  solved: Group[] // groups found, in order of discovery
  lives: number // mistakes remaining; starts at LIVES_START
  status: Status
  guessRows: Tier[][] // one row per submitted guess (tiers of the 4 items) — share grid
  lastResult: LastResult
}

export type ClustersAction =
  | { type: 'select'; item: string }
  | { type: 'deselect' } // clear all selection
  | { type: 'shuffle' }
  | { type: 'submit' }
  | { type: 'new'; seed: number }
  | { type: 'reset' }

// -- Generation --------------------------------------------------------------

/** true if `g` collides with an already-chosen group (same name or shared item). */
function conflicts(g: Group, used: Set<string>, chosen: Group[]): boolean {
  if (chosen.some((c) => c.name === g.name)) return true
  return g.items.some((it) => used.has(it))
}

/**
 * Pick 4 distinct, non-overlapping groups — one per tier when possible — then
 * top up from any tier if a tier is exhausted. Consumes rng deterministically.
 */
export function pickGroups(rng: Rng): Group[] {
  const chosen: Group[] = []
  const used = new Set<string>()
  const take = (g: Group) => {
    chosen.push(g)
    for (const it of g.items) used.add(it)
  }

  for (const tier of [0, 1, 2, 3] as Tier[]) {
    const pool = BANK.filter((g) => g.tier === tier && !conflicts(g, used, chosen))
    if (pool.length === 0) continue
    take(pool[Math.floor(rng() * pool.length)])
  }

  while (chosen.length < GROUP_COUNT) {
    const pool = BANK.filter((g) => !conflicts(g, used, chosen))
    if (pool.length === 0) break
    take(pool[Math.floor(rng() * pool.length)])
  }

  return chosen.slice(0, GROUP_COUNT).sort((a, b) => a.tier - b.tier)
}

/** In-place Fisher-Yates using the injected rng. */
export function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Build a fresh initial state. Consumes rng only here. */
export function generateGame(rng: Rng, seed = 0): ClustersState {
  const groups = pickGroups(rng)
  const tiles = shuffleInPlace(
    groups.flatMap((g) => [...g.items]),
    rng,
  )
  return {
    seed,
    groups,
    tiles,
    selected: [],
    solved: [],
    lives: LIVES_START,
    status: 'playing',
    guessRows: [],
    lastResult: 'none',
  }
}

export function createGame(seed: number): ClustersState {
  return generateGame(mulberry32(seed), seed)
}

// -- Pure helpers ------------------------------------------------------------

/** The group (among the four answers) an item belongs to, or undefined. */
export function groupOfItem(state: ClustersState, item: string): Group | undefined {
  return state.groups.find((g) => g.items.includes(item))
}

/** Deterministic left-rotation of the remaining tiles (rng-free "shuffle"). */
export function rotateTiles(tiles: string[]): string[] {
  const n = tiles.length
  if (n <= 1) return tiles.slice()
  const k = 5 % n
  return tiles.slice(k).concat(tiles.slice(0, k))
}

// -- Reducer -----------------------------------------------------------------

export function reduce(state: ClustersState, action: ClustersAction): ClustersState {
  switch (action.type) {
    case 'reset':
      return createGame(state.seed)
    case 'new':
      return createGame(action.seed)

    case 'deselect':
      if (state.selected.length === 0) return { ...state, lastResult: 'none' }
      return { ...state, selected: [], lastResult: 'none' }

    case 'shuffle': {
      if (state.status !== 'playing') return state
      return { ...state, tiles: rotateTiles(state.tiles), lastResult: 'none' }
    }

    case 'select': {
      if (state.status !== 'playing') return state
      const item = action.item
      if (!state.tiles.includes(item)) return { ...state, lastResult: 'none' }
      if (state.selected.includes(item)) {
        // toggle off
        return {
          ...state,
          selected: state.selected.filter((x) => x !== item),
          lastResult: 'none',
        }
      }
      if (state.selected.length >= GROUP_SIZE) return { ...state, lastResult: 'none' } // cap 4
      return { ...state, selected: [...state.selected, item], lastResult: 'none' }
    }

    case 'submit': {
      if (state.status !== 'playing') return state
      if (state.selected.length !== GROUP_SIZE) return { ...state, lastResult: 'none' }

      // How many of the selected items fall into each group?
      const counts = new Map<string, number>()
      const tiers: Tier[] = []
      for (const item of state.selected) {
        const g = groupOfItem(state, item)
        if (g) {
          counts.set(g.name, (counts.get(g.name) ?? 0) + 1)
          tiers.push(g.tier)
        }
      }

      const solvedGroup = state.groups.find((g) => counts.get(g.name) === GROUP_SIZE)

      if (solvedGroup) {
        // Correct — lock the group in.
        const tileSet = new Set<string>(solvedGroup.items)
        const solved = [...state.solved, solvedGroup]
        const status: Status = solved.length === GROUP_COUNT ? 'won' : 'playing'
        const row: Tier[] = [solvedGroup.tier, solvedGroup.tier, solvedGroup.tier, solvedGroup.tier]
        return {
          ...state,
          tiles: state.tiles.filter((t) => !tileSet.has(t)),
          selected: [],
          solved,
          status,
          guessRows: [...state.guessRows, row],
          lastResult: 'correct',
        }
      }

      // Wrong — lose a life. "One away" iff exactly 3 share a single group.
      const maxInOne = Math.max(...counts.values())
      const lives = state.lives - 1
      const status: Status = lives <= 0 ? 'lost' : 'playing'
      return {
        ...state,
        selected: [],
        lives,
        status,
        guessRows: [...state.guessRows, tiers],
        lastResult: maxInOne === 3 ? 'one-away' : 'wrong',
      }
    }

    default:
      return state
  }
}

// -- Scoring -----------------------------------------------------------------

/** Higher = better, always a positive integer, 0 before any progress. */
export function score(state: ClustersState): number {
  if (state.status === 'won') return 1000 + state.lives * 250
  return state.solved.length * 150
}

/** Mistakes made so far (0..LIVES_START). */
export function mistakes(state: ClustersState): number {
  return LIVES_START - state.lives
}
