// Hangman — a classic guess-the-word engine.
//
// Pure and deterministic: the only source of randomness is an injected `Rng`
// used to pick the secret word, so games are reproducible in tests. The word
// list (with a category hint) is bundled in code — no fetch, no external deps.

export const MAX_MISSES = 6

export type Rng = () => number

export type Status = 'playing' | 'won' | 'lost'

export interface WordEntry {
  /** The secret word, lowercase a–z, 4–9 letters. */
  word: string
  /** A short category hint shown to the player. */
  category: string
}

export interface GameState {
  /** The secret word, lowercased. */
  word: string
  /** Category hint for the secret word. */
  category: string
  /** Letters the player has guessed, lowercase, in guess order (no dupes). */
  guessed: string[]
  /** Count of wrong guesses so far (0…MAX_MISSES). */
  misses: number
  status: Status
}

/**
 * A curated set of common words (4–9 letters, no proper nouns), each tagged
 * with a category that doubles as the on-screen hint. Picking is driven by an
 * injected RNG so pure functions never touch Math.random.
 */
export const WORDS: readonly WordEntry[] = [
  // Animals
  { word: 'tiger', category: 'Animal' },
  { word: 'zebra', category: 'Animal' },
  { word: 'panda', category: 'Animal' },
  { word: 'koala', category: 'Animal' },
  { word: 'otter', category: 'Animal' },
  { word: 'moose', category: 'Animal' },
  { word: 'shark', category: 'Animal' },
  { word: 'whale', category: 'Animal' },
  { word: 'eagle', category: 'Animal' },
  { word: 'horse', category: 'Animal' },
  { word: 'mouse', category: 'Animal' },
  { word: 'sheep', category: 'Animal' },
  { word: 'goose', category: 'Animal' },
  { word: 'snake', category: 'Animal' },
  { word: 'rabbit', category: 'Animal' },
  { word: 'monkey', category: 'Animal' },
  { word: 'donkey', category: 'Animal' },
  { word: 'turtle', category: 'Animal' },
  { word: 'walrus', category: 'Animal' },
  { word: 'badger', category: 'Animal' },
  { word: 'beaver', category: 'Animal' },
  { word: 'ferret', category: 'Animal' },
  { word: 'iguana', category: 'Animal' },
  { word: 'jaguar', category: 'Animal' },
  { word: 'lizard', category: 'Animal' },
  { word: 'parrot', category: 'Animal' },
  { word: 'rooster', category: 'Animal' },
  { word: 'giraffe', category: 'Animal' },
  { word: 'gorilla', category: 'Animal' },
  { word: 'panther', category: 'Animal' },
  { word: 'penguin', category: 'Animal' },
  { word: 'raccoon', category: 'Animal' },
  { word: 'dolphin', category: 'Animal' },
  { word: 'octopus', category: 'Animal' },
  { word: 'ostrich', category: 'Animal' },
  { word: 'buffalo', category: 'Animal' },
  { word: 'cheetah', category: 'Animal' },
  { word: 'leopard', category: 'Animal' },
  { word: 'hamster', category: 'Animal' },
  { word: 'peacock', category: 'Animal' },
  { word: 'sparrow', category: 'Animal' },
  { word: 'antelope', category: 'Animal' },
  { word: 'elephant', category: 'Animal' },
  { word: 'squirrel', category: 'Animal' },
  { word: 'flamingo', category: 'Animal' },
  { word: 'kangaroo', category: 'Animal' },
  { word: 'crocodile', category: 'Animal' },
  { word: 'butterfly', category: 'Animal' },
  { word: 'porcupine', category: 'Animal' },
  { word: 'jellyfish', category: 'Animal' },
  // Food & drink
  { word: 'bread', category: 'Food' },
  { word: 'apple', category: 'Food' },
  { word: 'mango', category: 'Food' },
  { word: 'lemon', category: 'Food' },
  { word: 'peach', category: 'Food' },
  { word: 'grape', category: 'Food' },
  { word: 'melon', category: 'Food' },
  { word: 'olive', category: 'Food' },
  { word: 'onion', category: 'Food' },
  { word: 'pasta', category: 'Food' },
  { word: 'pizza', category: 'Food' },
  { word: 'salad', category: 'Food' },
  { word: 'honey', category: 'Food' },
  { word: 'sugar', category: 'Food' },
  { word: 'candy', category: 'Food' },
  { word: 'cocoa', category: 'Food' },
  { word: 'juice', category: 'Food' },
  { word: 'butter', category: 'Food' },
  { word: 'cheese', category: 'Food' },
  { word: 'cherry', category: 'Food' },
  { word: 'banana', category: 'Food' },
  { word: 'carrot', category: 'Food' },
  { word: 'potato', category: 'Food' },
  { word: 'tomato', category: 'Food' },
  { word: 'pepper', category: 'Food' },
  { word: 'walnut', category: 'Food' },
  { word: 'cookie', category: 'Food' },
  { word: 'muffin', category: 'Food' },
  { word: 'noodle', category: 'Food' },
  { word: 'waffle', category: 'Food' },
  { word: 'yogurt', category: 'Food' },
  { word: 'pancake', category: 'Food' },
  { word: 'popcorn', category: 'Food' },
  { word: 'pretzel', category: 'Food' },
  { word: 'pumpkin', category: 'Food' },
  { word: 'avocado', category: 'Food' },
  { word: 'biscuit', category: 'Food' },
  { word: 'cabbage', category: 'Food' },
  { word: 'lettuce', category: 'Food' },
  { word: 'sausage', category: 'Food' },
  { word: 'spinach', category: 'Food' },
  { word: 'oatmeal', category: 'Food' },
  { word: 'sandwich', category: 'Food' },
  { word: 'broccoli', category: 'Food' },
  { word: 'cucumber', category: 'Food' },
  { word: 'dumpling', category: 'Food' },
  { word: 'omelette', category: 'Food' },
  { word: 'macaroni', category: 'Food' },
  { word: 'pineapple', category: 'Food' },
  { word: 'chocolate', category: 'Food' },
  { word: 'raspberry', category: 'Food' },
  // Nature
  { word: 'river', category: 'Nature' },
  { word: 'ocean', category: 'Nature' },
  { word: 'beach', category: 'Nature' },
  { word: 'cliff', category: 'Nature' },
  { word: 'field', category: 'Nature' },
  { word: 'grass', category: 'Nature' },
  { word: 'plant', category: 'Nature' },
  { word: 'stone', category: 'Nature' },
  { word: 'cloud', category: 'Nature' },
  { word: 'storm', category: 'Nature' },
  { word: 'flower', category: 'Nature' },
  { word: 'forest', category: 'Nature' },
  { word: 'canyon', category: 'Nature' },
  { word: 'desert', category: 'Nature' },
  { word: 'meadow', category: 'Nature' },
  { word: 'island', category: 'Nature' },
  { word: 'jungle', category: 'Nature' },
  { word: 'valley', category: 'Nature' },
  { word: 'breeze', category: 'Nature' },
  { word: 'pebble', category: 'Nature' },
  { word: 'blossom', category: 'Nature' },
  { word: 'glacier', category: 'Nature' },
  { word: 'iceberg', category: 'Nature' },
  { word: 'volcano', category: 'Nature' },
  { word: 'thunder', category: 'Nature' },
  { word: 'rainbow', category: 'Nature' },
  { word: 'mountain', category: 'Nature' },
  { word: 'sunshine', category: 'Nature' },
  { word: 'seashell', category: 'Nature' },
  { word: 'waterfall', category: 'Nature' },
  // Around the house
  { word: 'chair', category: 'Household' },
  { word: 'table', category: 'Household' },
  { word: 'couch', category: 'Household' },
  { word: 'clock', category: 'Household' },
  { word: 'lamp', category: 'Household' },
  { word: 'broom', category: 'Household' },
  { word: 'towel', category: 'Household' },
  { word: 'plate', category: 'Household' },
  { word: 'spoon', category: 'Household' },
  { word: 'knife', category: 'Household' },
  { word: 'kettle', category: 'Household' },
  { word: 'pillow', category: 'Household' },
  { word: 'carpet', category: 'Household' },
  { word: 'basket', category: 'Household' },
  { word: 'candle', category: 'Household' },
  { word: 'drawer', category: 'Household' },
  { word: 'mirror', category: 'Household' },
  { word: 'pantry', category: 'Household' },
  { word: 'faucet', category: 'Household' },
  { word: 'blanket', category: 'Household' },
  { word: 'cabinet', category: 'Household' },
  { word: 'curtain', category: 'Household' },
  { word: 'dresser', category: 'Household' },
  { word: 'toaster', category: 'Household' },
  { word: 'mattress', category: 'Household' },
  { word: 'umbrella', category: 'Household' },
  { word: 'doorbell', category: 'Household' },
  { word: 'wardrobe', category: 'Household' },
  // Clothing
  { word: 'shirt', category: 'Clothing' },
  { word: 'pants', category: 'Clothing' },
  { word: 'dress', category: 'Clothing' },
  { word: 'scarf', category: 'Clothing' },
  { word: 'glove', category: 'Clothing' },
  { word: 'boots', category: 'Clothing' },
  { word: 'jacket', category: 'Clothing' },
  { word: 'sweater', category: 'Clothing' },
  { word: 'sandals', category: 'Clothing' },
  { word: 'sneaker', category: 'Clothing' },
  { word: 'raincoat', category: 'Clothing' },
  { word: 'necktie', category: 'Clothing' },
  { word: 'mittens', category: 'Clothing' },
  { word: 'trousers', category: 'Clothing' },
  // Sports & games
  { word: 'chess', category: 'Sport' },
  { word: 'rugby', category: 'Sport' },
  { word: 'boxing', category: 'Sport' },
  { word: 'hockey', category: 'Sport' },
  { word: 'soccer', category: 'Sport' },
  { word: 'tennis', category: 'Sport' },
  { word: 'karate', category: 'Sport' },
  { word: 'skiing', category: 'Sport' },
  { word: 'archery', category: 'Sport' },
  { word: 'cricket', category: 'Sport' },
  { word: 'bowling', category: 'Sport' },
  { word: 'cycling', category: 'Sport' },
  { word: 'surfing', category: 'Sport' },
  { word: 'sailing', category: 'Sport' },
  { word: 'baseball', category: 'Sport' },
  { word: 'football', category: 'Sport' },
  { word: 'swimming', category: 'Sport' },
  { word: 'climbing', category: 'Sport' },
  { word: 'marathon', category: 'Sport' },
  { word: 'lacrosse', category: 'Sport' },
  // Music
  { word: 'piano', category: 'Music' },
  { word: 'flute', category: 'Music' },
  { word: 'drums', category: 'Music' },
  { word: 'cello', category: 'Music' },
  { word: 'organ', category: 'Music' },
  { word: 'violin', category: 'Music' },
  { word: 'guitar', category: 'Music' },
  { word: 'melody', category: 'Music' },
  { word: 'rhythm', category: 'Music' },
  { word: 'trumpet', category: 'Music' },
  { word: 'harmony', category: 'Music' },
  { word: 'concert', category: 'Music' },
  { word: 'trombone', category: 'Music' },
  { word: 'clarinet', category: 'Music' },
  { word: 'keyboard', category: 'Music' },
  { word: 'saxophone', category: 'Music' },
  // Travel & vehicles
  { word: 'train', category: 'Travel' },
  { word: 'plane', category: 'Travel' },
  { word: 'truck', category: 'Travel' },
  { word: 'canoe', category: 'Travel' },
  { word: 'yacht', category: 'Travel' },
  { word: 'wagon', category: 'Travel' },
  { word: 'subway', category: 'Travel' },
  { word: 'ferry', category: 'Travel' },
  { word: 'rocket', category: 'Travel' },
  { word: 'engine', category: 'Travel' },
  { word: 'runway', category: 'Travel' },
  { word: 'harbor', category: 'Travel' },
  { word: 'luggage', category: 'Travel' },
  { word: 'airport', category: 'Travel' },
  { word: 'scooter', category: 'Travel' },
  { word: 'bicycle', category: 'Travel' },
  { word: 'sailboat', category: 'Travel' },
  { word: 'suitcase', category: 'Travel' },
  { word: 'passport', category: 'Travel' },
  { word: 'airplane', category: 'Travel' },
  { word: 'submarine', category: 'Travel' },
  // Jobs
  { word: 'baker', category: 'Job' },
  { word: 'nurse', category: 'Job' },
  { word: 'pilot', category: 'Job' },
  { word: 'actor', category: 'Job' },
  { word: 'judge', category: 'Job' },
  { word: 'chef', category: 'Job' },
  { word: 'doctor', category: 'Job' },
  { word: 'artist', category: 'Job' },
  { word: 'author', category: 'Job' },
  { word: 'dancer', category: 'Job' },
  { word: 'farmer', category: 'Job' },
  { word: 'lawyer', category: 'Job' },
  { word: 'singer', category: 'Job' },
  { word: 'tailor', category: 'Job' },
  { word: 'painter', category: 'Job' },
  { word: 'plumber', category: 'Job' },
  { word: 'teacher', category: 'Job' },
  { word: 'dentist', category: 'Job' },
  { word: 'captain', category: 'Job' },
  { word: 'engineer', category: 'Job' },
  { word: 'mechanic', category: 'Job' },
  { word: 'gardener', category: 'Job' },
  { word: 'director', category: 'Job' },
  { word: 'reporter', category: 'Job' },
  { word: 'detective', category: 'Job' },
  { word: 'librarian', category: 'Job' },
  { word: 'architect', category: 'Job' },
  { word: 'astronaut', category: 'Job' },
  { word: 'carpenter', category: 'Job' },
  { word: 'scientist', category: 'Job' },
  { word: 'physician', category: 'Job' },
  // Body
  { word: 'elbow', category: 'Body' },
  { word: 'thumb', category: 'Body' },
  { word: 'ankle', category: 'Body' },
  { word: 'wrist', category: 'Body' },
  { word: 'heart', category: 'Body' },
  { word: 'spine', category: 'Body' },
  { word: 'finger', category: 'Body' },
  { word: 'muscle', category: 'Body' },
  { word: 'kidney', category: 'Body' },
  { word: 'stomach', category: 'Body' },
  { word: 'knuckle', category: 'Body' },
  { word: 'eyebrow', category: 'Body' },
  { word: 'shoulder', category: 'Body' },
  // Colors
  { word: 'amber', category: 'Color' },
  { word: 'coral', category: 'Color' },
  { word: 'green', category: 'Color' },
  { word: 'brown', category: 'Color' },
  { word: 'ivory', category: 'Color' },
  { word: 'olive', category: 'Color' },
  { word: 'violet', category: 'Color' },
  { word: 'yellow', category: 'Color' },
  { word: 'purple', category: 'Color' },
  { word: 'maroon', category: 'Color' },
  { word: 'crimson', category: 'Color' },
  { word: 'magenta', category: 'Color' },
  { word: 'lavender', category: 'Color' },
  { word: 'turquoise', category: 'Color' },
]

/** True when `letter` is a single a–z character (case-insensitive). */
export function isLetter(letter: string): boolean {
  return typeof letter === 'string' && /^[a-zA-Z]$/.test(letter)
}

/** Start a fresh game, choosing a word via the injected RNG. */
export function newGame(rng: Rng): GameState {
  const idx = Math.floor(rng() * WORDS.length)
  const entry = WORDS[Math.min(WORDS.length - 1, Math.max(0, idx))]
  return {
    word: entry.word.toLowerCase(),
    category: entry.category,
    guessed: [],
    misses: 0,
    status: 'playing',
  }
}

/** The distinct letters that make up the secret word. */
export function answerLetters(state: GameState): Set<string> {
  return new Set(state.word.split(''))
}

/** True once every distinct letter of the word has been guessed. */
export function isWon(state: GameState): boolean {
  const guessed = new Set(state.guessed)
  for (const ch of answerLetters(state)) {
    if (!guessed.has(ch)) return false
  }
  return true
}

/** True once the player has used up all allowed wrong guesses. */
export function isLost(state: GameState): boolean {
  return state.misses >= MAX_MISSES
}

/**
 * The word as a display array, one entry per position: the uppercase letter if
 * it has been guessed (or the game is over), otherwise `null` for a blank.
 */
export function maskedLetters(state: GameState): (string | null)[] {
  const guessed = new Set(state.guessed)
  const revealAll = state.status !== 'playing'
  return state.word.split('').map((ch) => (revealAll || guessed.has(ch) ? ch.toUpperCase() : null))
}

/** Convenience string form of the mask, e.g. "P _ A _ E". */
export function maskedWord(state: GameState, blank = '_'): string {
  return maskedLetters(state)
    .map((ch) => ch ?? blank)
    .join(' ')
}

/**
 * Guess a letter. Returns the same state reference (no change) when the game is
 * over, the input is not a single letter, or the letter was already guessed —
 * so the caller can detect a rejected guess by reference equality. Otherwise
 * the letter is recorded; a wrong guess increments `misses`, and win/lose
 * status is recomputed (win when all letters are revealed, lose after
 * MAX_MISSES wrong guesses).
 */
export function guessLetter(state: GameState, letter: string): GameState {
  if (state.status !== 'playing') return state
  if (!isLetter(letter)) return state
  const ch = letter.toLowerCase()
  if (state.guessed.includes(ch)) return state

  const guessed = [...state.guessed, ch]
  const hit = state.word.includes(ch)
  const misses = hit ? state.misses : state.misses + 1

  const next: GameState = { ...state, guessed, misses }
  if (isWon(next)) next.status = 'won'
  else if (isLost(next)) next.status = 'lost'
  return next
}

/** Whether a given guessed letter was a hit (appears in the word). */
export function isHit(state: GameState, letter: string): boolean {
  return state.word.includes(letter.toLowerCase())
}
