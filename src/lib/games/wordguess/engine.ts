// Word Guess — a Wordle-style 5-letter word guessing engine.
//
// Pure and deterministic: the only source of randomness is an injected `Rng`
// used to pick the answer, so games are reproducible in tests. The word list is
// bundled in code (no fetch, no external deps).

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

export type Rng = () => number

// -- PRNG (byte-identical to the wordguess/clusters template's mulberry32) ----

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

/** Per-letter feedback, Wordle-style. */
export type LetterState = 'correct' | 'present' | 'absent'

export interface Guess {
  /** The guessed word, lowercased, exactly WORD_LENGTH letters. */
  word: string
  /** Per-position feedback aligned to `word`. */
  result: LetterState[]
}

export type Status = 'playing' | 'won' | 'lost'

export interface GameState {
  /** The hidden answer, lowercased. */
  answer: string
  /** Submitted guesses in order (max MAX_GUESSES). */
  guesses: Guess[]
  status: Status
}

/**
 * A curated set of common 5-letter answer words (no proper nouns). Picking is
 * driven by an injected RNG so pure functions never touch Math.random.
 */
export const ANSWERS: readonly string[] = [
  'about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt', 'adult', 'after', 'again',
  'agent', 'agree', 'ahead', 'alarm', 'album', 'alert', 'alike', 'alive', 'allow', 'alone',
  'along', 'alter', 'among', 'anger', 'angle', 'angry', 'apart', 'apple', 'apply', 'arena',
  'argue', 'arise', 'array', 'aside', 'asset', 'audio', 'audit', 'avoid', 'award', 'aware',
  'badly', 'baker', 'bases', 'basic', 'beach', 'began', 'begin', 'being', 'below', 'bench',
  'birth', 'black', 'blame', 'blank', 'blast', 'blind', 'block', 'blood', 'board', 'boost',
  'booth', 'bound', 'brain', 'brand', 'brass', 'brave', 'bread', 'break', 'breed', 'brief',
  'bring', 'broad', 'broke', 'brown', 'build', 'built', 'buyer', 'cabin', 'cable', 'candy',
  'carry', 'catch', 'cause', 'chain', 'chair', 'chaos', 'charm', 'chart', 'chase', 'cheap',
  'check', 'chest', 'chief', 'child', 'chose', 'civil', 'claim', 'class', 'clean', 'clear',
  'click', 'climb', 'clock', 'close', 'cloud', 'coach', 'coast', 'could', 'count', 'court',
  'cover', 'craft', 'crane', 'crash', 'crazy', 'cream', 'crime', 'cross', 'crowd', 'crown',
  'crude', 'curve', 'cycle', 'daily', 'dance', 'dated', 'dealt', 'death', 'debut', 'delay',
  'depth', 'doing', 'doubt', 'dozen', 'draft', 'drama', 'drank', 'dream', 'dress', 'drill',
  'drink', 'drive', 'drove', 'dying', 'eager', 'early', 'earth', 'eight', 'elite', 'empty',
  'enemy', 'enjoy', 'enter', 'entry', 'equal', 'error', 'event', 'every', 'exact', 'exist',
  'extra', 'faith', 'false', 'fault', 'fiber', 'field', 'fifth', 'fifty', 'fight', 'final',
  'first', 'fixed', 'flame', 'flash', 'fleet', 'float', 'floor', 'fluid', 'focus', 'force',
  'forth', 'forty', 'forum', 'found', 'frame', 'frank', 'fraud', 'fresh', 'front', 'frost',
  'fruit', 'fully', 'funny', 'giant', 'given', 'glass', 'globe', 'glory', 'going', 'grace',
  'grade', 'grain', 'grand', 'grant', 'grape', 'grass', 'great', 'green', 'greet', 'gross',
  'group', 'grown', 'guard', 'guess', 'guest', 'guide', 'happy', 'harsh', 'heart', 'heavy',
  'hobby', 'honey', 'horse', 'hotel', 'house', 'human', 'humor', 'ideal', 'image', 'index',
  'inner', 'input', 'issue', 'joint', 'judge', 'juice', 'knife', 'knock', 'known', 'label',
  'labor', 'large', 'laser', 'later', 'laugh', 'layer', 'learn', 'lease', 'least', 'leave',
  'legal', 'lemon', 'level', 'light', 'limit', 'links', 'lives', 'local', 'logic', 'loose',
  'lower', 'loyal', 'lucky', 'lunch', 'lying', 'magic', 'major', 'maker', 'march', 'match',
  'maybe', 'mayor', 'meant', 'medal', 'media', 'medic', 'melon', 'mercy', 'metal', 'meter',
  'might', 'minor', 'minus', 'mixed', 'model', 'money', 'month', 'moral', 'motor', 'mount',
  'mouse', 'mouth', 'movie', 'music', 'naval', 'needs', 'nerve', 'never', 'newly', 'night',
  'noble', 'noise', 'north', 'noted', 'novel', 'nurse', 'occur', 'ocean', 'offer', 'often',
  'olive', 'onion', 'order', 'organ', 'other', 'ought', 'ozone', 'paint', 'panel', 'paper',
  'party', 'pasta', 'patch', 'peace', 'pearl', 'phase', 'phone', 'photo', 'piano', 'piece',
  'pilot', 'pitch', 'pizza', 'place', 'plain', 'plane', 'plant', 'plate', 'plaza', 'point',
  'polar', 'porch', 'pound', 'power', 'press', 'price', 'pride', 'prime', 'print', 'prior',
  'prize', 'proof', 'proud', 'prove', 'pulse', 'punch', 'pupil', 'queen', 'query', 'quest',
  'quick', 'quiet', 'quite', 'radio', 'raise', 'rally', 'range', 'rapid', 'ratio', 'reach',
  'react', 'ready', 'realm', 'rebel', 'refer', 'relax', 'reply', 'rider', 'ridge', 'right',
  'rigid', 'rival', 'river', 'roast', 'robot', 'rocky', 'rough', 'round', 'route', 'royal',
  'rural', 'salad', 'sauce', 'scale', 'scene', 'scope', 'score', 'scout', 'sense', 'serve',
  'setup', 'seven', 'shade', 'shady', 'shake', 'shall', 'shape', 'share', 'shark', 'sharp',
  'sheep', 'sheet', 'shelf', 'shell', 'shift', 'shine', 'shiny', 'shirt', 'shock', 'shoot',
  'shore', 'short', 'shown', 'sight', 'silly', 'since', 'sixth', 'sixty', 'sized', 'skill',
  'skirt', 'slate', 'sleep', 'slice', 'slide', 'slope', 'small', 'smart', 'smell', 'smile',
  'smoke', 'snack', 'snake', 'solar', 'solid', 'solve', 'sorry', 'sound', 'south', 'space',
  'spare', 'spark', 'speak', 'speed', 'spell', 'spend', 'spent', 'spice', 'spicy', 'spike',
  'split', 'spoke', 'sport', 'spray', 'squad', 'stack', 'staff', 'stage', 'stair', 'stake',
  'stand', 'stare', 'start', 'state', 'steam', 'steel', 'steep', 'steer', 'stern', 'stick',
  'still', 'sting', 'stock', 'stone', 'stood', 'stool', 'store', 'storm', 'story', 'stout',
  'straw', 'strip', 'stuck', 'study', 'stuff', 'stump', 'style', 'sugar', 'suite', 'sunny',
  'super', 'surge', 'sweet', 'swift', 'swing', 'sword', 'table', 'taken', 'taste', 'teach',
  'teeth', 'thank', 'theft', 'their', 'theme', 'there', 'these', 'thick', 'thief', 'thing',
  'think', 'third', 'those', 'three', 'threw', 'throw', 'thumb', 'tiger', 'tight', 'timer',
  'times', 'tired', 'title', 'toast', 'today', 'token', 'tooth', 'topic', 'torch', 'total',
  'touch', 'tough', 'towel', 'tower', 'toxic', 'trace', 'track', 'trade', 'trail', 'train',
  'treat', 'trend', 'trial', 'tribe', 'trick', 'tried', 'tries', 'truck', 'truly', 'trust',
  'truth', 'twice', 'twist', 'ultra', 'uncle', 'under', 'undue', 'union', 'unify', 'unity',
  'until', 'upper', 'upset', 'urban', 'usage', 'usual', 'valid', 'value', 'vapor', 'video',
  'virus', 'visit', 'vital', 'vocal', 'voice', 'voter', 'wagon', 'waist', 'waste', 'watch',
  'water', 'wheat', 'wheel', 'where', 'which', 'while', 'white', 'whole', 'whose', 'woman',
  'world', 'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'wrist', 'write', 'wrong',
  'wrote', 'yield', 'young', 'youth', 'zebra',
]

/**
 * Extra words accepted as guesses but never chosen as answers. Widens the set
 * of "real words" a player may try without inflating the answer pool.
 */
const EXTRA_GUESSES: readonly string[] = [
  'adieu', 'agile', 'aisle', 'alloy', 'aloft', 'aloof', 'amber', 'amiss', 'ample', 'antic',
  'aroma', 'ascot', 'aphid', 'attic', 'aured', 'axiom', 'azure', 'bacon', 'badge', 'bagel',
  'baker', 'balmy', 'banjo', 'barge', 'basil', 'baton', 'beard', 'beast', 'befit', 'belch',
  'berry', 'bicep', 'bilge', 'binge', 'bison', 'blaze', 'bleak', 'bleed', 'blend', 'bliss',
  'blitz', 'bloke', 'bloom', 'blown', 'bluff', 'blunt', 'blurb', 'blush', 'boast', 'bongo',
  'bonus', 'booze', 'bough', 'boxer', 'brace', 'braid', 'brawl', 'briar', 'bribe', 'brine',
  'brisk', 'brook', 'broth', 'brute', 'buddy', 'budge', 'buggy', 'bunch', 'bunny', 'burnt',
  'burst', 'cacao', 'cadet', 'cager', 'cameo', 'canal', 'canoe', 'caper', 'cargo', 'caste',
  'cedar', 'chalk', 'champ', 'chant', 'chard', 'chart', 'cheek', 'cheer', 'chess', 'chewy',
  'chili', 'chill', 'chime', 'chirp', 'choir', 'chomp', 'chord', 'chore', 'chuck', 'chunk',
  'churn', 'cider', 'cigar', 'cinch', 'clamp', 'clang', 'clank', 'clasp', 'cleat', 'clerk',
  'cliff', 'cloak', 'clone', 'cluck', 'clump', 'clung', 'coral', 'corny', 'couch', 'cough',
  'crack', 'craft', 'cramp', 'crank', 'crate', 'crave', 'crawl', 'creak', 'creed', 'creek',
  'creep', 'crept', 'crest', 'crisp', 'croak', 'crock', 'crony', 'crumb', 'crush', 'crust',
  'crypt', 'cubic', 'curly', 'curry', 'curse', 'dairy', 'daisy', 'dandy', 'dashy', 'decay',
  'decor', 'decoy', 'delta', 'dense', 'depot', 'devil', 'diary', 'digit', 'dimly', 'diner',
  'dingo', 'ditch', 'ditty', 'diver', 'dodge', 'donor', 'dorky', 'dowel', 'downy', 'dowry',
  'draft', 'drape', 'drawl', 'drawn', 'dread', 'dregs', 'dried', 'drier', 'droll', 'drone',
  'droop', 'drown', 'druid', 'drunk', 'dryly', 'dusky', 'dusty', 'dutch', 'dwarf', 'dwell',
  'eagle', 'easel', 'ebony', 'eerie', 'elbow', 'elder', 'elfin', 'elope', 'elude', 'ember',
  'emcee', 'empty', 'enact', 'ender', 'ennui', 'epoch', 'epoxy', 'equip', 'erase', 'essay',
  'ether', 'ethic', 'evade', 'evict', 'evoke', 'exalt', 'excel', 'expel', 'extol', 'fable',
  'facet', 'fancy', 'ferry', 'fetch', 'fever', 'fewer', 'fiend', 'fiery', 'filch', 'filet',
  'filmy', 'filth', 'finch', 'finer', 'first', 'fishy', 'fjord', 'flair', 'flaky', 'flank',
  'flare', 'flask', 'fleck', 'flick', 'flier', 'fling', 'flint', 'flirt', 'flock', 'flora',
  'flour', 'fluff', 'flung', 'flush', 'flute', 'foamy', 'foggy', 'folio', 'folly', 'foray',
  'forge', 'forgo', 'forte', 'foyer', 'freak', 'freed', 'freer', 'frill', 'frisk', 'frizz',
  'frock', 'froth', 'frown', 'fudge', 'fungi', 'funky', 'fussy', 'gaily', 'gamma', 'gaped',
  'gauge', 'gaunt', 'gauze', 'gavel', 'gawky', 'gecko', 'geeky', 'genie', 'genre', 'ghost',
  'ghoul', 'girth', 'given', 'glade', 'gland', 'glare', 'glaze', 'gleam', 'glean', 'glide',
  'glint', 'gloat', 'gloom', 'gluey', 'gnash', 'gnome', 'godly', 'golly', 'gonna', 'gooey',
  'goose', 'gorge', 'gouge', 'gourd', 'grabs', 'grail', 'grape', 'graph', 'grasp', 'gravy',
  'graze', 'grime', 'grimy', 'grind', 'gripe', 'groan', 'groin', 'groom', 'grope', 'grout',
  'grove', 'growl', 'grubs', 'gruel', 'gruff', 'grunt', 'guava', 'guild', 'guile', 'guilt',
  'guise', 'gulch', 'gully', 'gumbo', 'gummy', 'gusto', 'gusty', 'gutsy', 'hairy', 'halve',
  'handy', 'hardy', 'harem', 'haste', 'hasty', 'hatch', 'haunt', 'haven', 'havoc', 'hazel',
  'heady', 'heath', 'hedge', 'hefty', 'heron', 'hilly', 'hinge', 'hippo', 'hitch', 'hoard',
  'hoist', 'holly', 'homer', 'hound', 'hovel', 'hover', 'howdy', 'hunch', 'hurry', 'husky',
  'hydro', 'hyena', 'hymen', 'icily', 'icing', 'igloo', 'ileum', 'imbue', 'inbox', 'incur',
  'infer', 'ingot', 'inlay', 'inlet', 'inept', 'irate', 'irony', 'ivory', 'jaunt', 'jazzy',
  'jelly', 'jerky', 'jetty', 'jewel', 'jiffy', 'joker', 'jolly', 'joust', 'juicy', 'jumbo',
  'jumpy', 'junky', 'junta', 'kappa', 'karma', 'kayak', 'kebab', 'khaki', 'kinky', 'kiosk',
  'kitty', 'knack', 'kneel', 'knelt', 'knoll', 'koala', 'label', 'ladle', 'lager', 'lanky',
  'lapel', 'lardy', 'larva', 'lasso', 'latch', 'lathe', 'leach', 'leafy', 'leaky', 'leant',
  'leapt', 'ledge', 'leech', 'leery', 'lefty', 'legit', 'lemur', 'liege', 'lifer', 'lilac',
  'limbo', 'lingo', 'lithe', 'liver', 'livid', 'llama', 'loamy', 'loath', 'lobby', 'lofty',
  'logic', 'loner', 'lorry', 'lousy', 'lover', 'lowly', 'lucid', 'lumen', 'lumpy', 'lunar',
  'lupus', 'lurch', 'lurid', 'lusty', 'lymph', 'lynch', 'macaw', 'macho', 'madam', 'magma',
  'maize', 'mange', 'mango', 'mangy', 'maple', 'march', 'marsh', 'mason', 'matey', 'mauve',
  'mealy', 'meaty', 'melee', 'mimic', 'mince', 'miner', 'minty', 'moist', 'molar', 'moldy',
  'moody', 'moose', 'mossy', 'mould', 'moult', 'mound', 'mourn', 'mousy', 'mover', 'mucky',
  'muddy', 'mulch', 'mummy', 'mushy', 'musky', 'musty', 'nacho', 'nadir', 'nanny', 'nasal',
  'nasty', 'natal', 'needy', 'neigh', 'nerdy', 'nifty', 'ninja', 'ninth', 'noose', 'notch',
  'nudge', 'nutty', 'nylon', 'nymph', 'oaken', 'oaten', 'ocher', 'octet', 'olden', 'older',
  'ombre', 'omega', 'opium', 'optic', 'orbit', 'ounce', 'ouzel', 'ovary', 'overt', 'ovoid',
  'owing', 'owner', 'paddy', 'pagan', 'paler', 'palsy', 'pansy', 'papal', 'parka', 'parry',
  'pasty', 'patio', 'patsy', 'payer', 'peach', 'pecan', 'penne', 'penny', 'perch', 'perky',
  'pesky', 'pesto', 'petal', 'petty', 'phony', 'picky', 'piety', 'piggy', 'pinch', 'piney',
  'pinky', 'pinto', 'piper', 'pique', 'pixel', 'pixie', 'plaid', 'plank', 'pluck', 'plumb',
  'plume', 'plump', 'plush', 'poesy', 'poise', 'poker', 'polka', 'pooch', 'poppy', 'posse',
  'pouch', 'pound', 'preen', 'prick', 'pricy', 'primp', 'prism', 'privy', 'probe', 'prong',
  'proxy', 'prude', 'prune', 'psych', 'pudgy', 'puffy', 'pulpy', 'pygmy', 'quack', 'quail',
  'quake', 'qualm', 'quark', 'quart', 'quash', 'quasi', 'quell', 'quill', 'quilt', 'quirk',
  'quota', 'quoth', 'rabid', 'racer', 'radar', 'raspy', 'raven', 'rayon', 'rebar', 'rebut',
  'recap', 'regal', 'rehab', 'reign', 'relic', 'renew', 'repay', 'repel', 'resin', 'rhino',
  'rhyme', 'ridge', 'rifle', 'ripen', 'riper', 'risky', 'robin', 'rodeo', 'rogue', 'roomy',
  'roost', 'rotor', 'rouge', 'rowdy', 'rowel', 'rugby', 'ruler', 'rumba', 'rumor', 'runic',
  'rusty', 'sable', 'saber', 'sadly', 'saggy', 'saint', 'salsa', 'salty', 'sandy', 'sappy',
  'sassy', 'satin', 'satyr', 'savor', 'savvy', 'scald', 'scalp', 'scaly', 'scamp', 'scant',
  'scare', 'scarf', 'scary', 'scoff', 'scold', 'scone', 'scoop', 'scorn', 'scour', 'scowl',
  'scram', 'scrap', 'scrub', 'scrum', 'seedy', 'shalt', 'shard', 'sheen', 'sheik', 'shiek',
  'shoal', 'shone', 'shrew', 'shrub', 'shrug', 'shuck', 'shunt', 'shush', 'siege', 'sieve',
  'silky', 'sinew', 'singe', 'siren', 'sissy', 'skimp', 'skulk', 'skull', 'skunk', 'slack',
  'slain', 'slang', 'slant', 'slash', 'sleek', 'sleet', 'slept', 'slime', 'slimy', 'sling',
  'slink', 'sloop', 'slosh', 'sloth', 'slump', 'slung', 'slunk', 'slurp', 'slush', 'slyly',
  'smash', 'smear', 'smirk', 'smite', 'smith', 'smock', 'smote', 'snail', 'snare', 'snarl',
  'sneak', 'sneer', 'snide', 'sniff', 'snipe', 'snoop', 'snore', 'snort', 'snout', 'snowy',
  'snuck', 'snuff', 'soapy', 'sober', 'soggy', 'sonar', 'sooth', 'sooty', 'sowed', 'spade',
  'spank', 'spasm', 'spawn', 'spear', 'sperm', 'spiel', 'spilt', 'spine', 'spiny', 'spire',
  'spite', 'splat', 'spool', 'spoon', 'spore', 'sprig', 'sprue', 'spurn', 'spurt', 'squab',
  'squat', 'squib', 'stack', 'staid', 'stalk', 'stall', 'stamp', 'stank', 'stead', 'steak',
  'stead', 'stein', 'stilt', 'stint', 'stoic', 'stoke', 'stole', 'stomp', 'stony', 'stork',
  'strap', 'stray', 'strut', 'stung', 'stunk', 'stunt', 'suave', 'sulky', 'sully', 'sumac',
  'sunup', 'surer', 'surly', 'swami', 'swash', 'swath', 'swear', 'sweat', 'swept', 'swirl',
  'swish', 'swoon', 'swoop', 'sworn', 'syrup', 'tabby', 'taffy', 'taint', 'tally', 'talon',
  'tamer', 'tango', 'tangy', 'taper', 'tapir', 'tardy', 'tarot', 'tarry', 'tasty', 'tatty',
  'taunt', 'tawny', 'teary', 'tease', 'teddy', 'tempo', 'tenet', 'tenor', 'tepee', 'tepid',
  'terse', 'testy', 'clove', 'toxin', 'theta', 'thong', 'thorn', 'thump', 'thyme', 'tiara',
  'tidal', 'tipsy', 'titan', 'tithe', 'toffy', 'togas', 'toile', 'tonal', 'tonga', 'tonic',
  'topaz', 'torso', 'toter', 'trawl', 'triad', 'trill', 'tripe', 'troll', 'troop', 'trope',
  'trout', 'trove', 'truce', 'trunk', 'tulip', 'tumor', 'tunic', 'turbo', 'tutor', 'tweak',
  'tweed', 'tweet', 'twirl', 'twang', 'udder', 'ulcer', 'umbra', 'unarm', 'unbar', 'uncut',
  'undid', 'undue', 'unfed', 'unfit', 'unlit', 'unmet', 'unset', 'untie', 'unwed', 'unzip',
  'usher', 'usurp', 'valet', 'valor', 'valve', 'vault', 'vegan', 'venom', 'venue', 'verge',
  'verse', 'vicar', 'vigil', 'vigor', 'villa', 'viola', 'viper', 'visor', 'vista', 'vixen',
  'vodka', 'vogue', 'voila', 'vouch', 'vowel', 'wacky', 'wafer', 'wager', 'waltz', 'warty',
  'washy', 'weary', 'weave', 'wedge', 'weedy', 'weigh', 'weird', 'welsh', 'welts', 'whack',
  'whale', 'wharf', 'weepy', 'whelp', 'whiff', 'whine', 'whiny', 'whirl', 'whisk', 'wince',
  'winch', 'windy', 'wiser', 'witch', 'witty', 'woken', 'woozy', 'wordy', 'wooer', 'wooly',
  'wrack', 'wrath', 'wreak', 'wreck', 'wrung', 'wryly', 'yacht', 'yearn', 'yeast', 'yodel',
  'yokel', 'yucky', 'zesty', 'zonal', 'zoned', 'zooms',
]

/** Words accepted as a legal guess (answers ∪ extras). */
export const VALID_GUESSES: ReadonlySet<string> = new Set([
  ...ANSWERS.filter((w) => w.length === WORD_LENGTH),
  ...EXTRA_GUESSES.filter((w) => w.length === WORD_LENGTH),
])

/** True when `word` is a legal 5-letter guess in the dictionary. */
export function isValidGuess(word: string): boolean {
  return typeof word === 'string' && word.length === WORD_LENGTH && VALID_GUESSES.has(word.toLowerCase())
}

/**
 * Score a guess against the answer with correct duplicate-letter handling.
 *
 * Two passes, classic Wordle rule:
 *  1. Mark exact-position matches as 'correct' and consume those answer letters.
 *  2. For the rest, a letter is 'present' only while unconsumed copies of it
 *     remain in the answer — so a guess with two of a letter but an answer with
 *     one yields a single 'present'/'correct' and the surplus is 'absent'.
 */
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase()
  const a = answer.toLowerCase()
  const result: LetterState[] = new Array(WORD_LENGTH).fill('absent')

  // Remaining answer-letter counts after removing exact matches.
  const remaining: Record<string, number> = {}
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct'
    } else {
      remaining[a[i]] = (remaining[a[i]] ?? 0) + 1
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue
    const c = g[i]
    if ((remaining[c] ?? 0) > 0) {
      result[i] = 'present'
      remaining[c] -= 1
    }
  }

  return result
}

/** Start a fresh game, choosing an answer via the injected RNG. */
export function newGame(rng: Rng): GameState {
  const idx = Math.floor(rng() * ANSWERS.length)
  const answer = ANSWERS[Math.min(ANSWERS.length - 1, Math.max(0, idx))]
  return { answer, guesses: [], status: 'playing' }
}

/**
 * Submit a guess. Returns the same state reference (no change) when the game is
 * over or the guess is not a legal dictionary word — the caller can detect a
 * rejected guess by reference equality and react (e.g. shake). On a legal guess
 * the state advances, appending the scored guess and updating win/lose status
 * (a win on the exact answer, a loss once MAX_GUESSES have been used).
 */
export function submitGuess(state: GameState, guess: string): GameState {
  if (state.status !== 'playing') return state
  const word = guess.toLowerCase()
  if (!isValidGuess(word)) return state

  const result = scoreGuess(word, state.answer)
  const guesses = [...state.guesses, { word, result }]
  const won = word === state.answer.toLowerCase()
  const lost = !won && guesses.length >= MAX_GUESSES

  return {
    ...state,
    guesses,
    status: won ? 'won' : lost ? 'lost' : 'playing',
  }
}

/**
 * Rebuild a board from saved guess words (e.g. today's persisted daily) by replaying them
 * through `submitGuess`. Returns null when the save cannot be a real game of this board —
 * a non-string / illegal word, or a guess after the game already ended — so the caller can
 * discard it instead of showing a corrupt board.
 */
export function restoreGame(fresh: GameState, words: readonly string[]): GameState | null {
  let s = fresh
  for (const w of words) {
    if (typeof w !== 'string') return null
    const next = submitGuess(s, w)
    if (next === s) return null
    s = next
  }
  return s
}
