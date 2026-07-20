import { describe, it, expect } from 'vitest'
import {
  START_FEN,
  applyMove,
  bestMove,
  capturedPieces,
  createGame,
  evaluateWhite,
  exportFEN,
  isCheckmate,
  isDraw,
  isInCheck,
  isInsufficientMaterial,
  isSquareAttacked,
  isStalemate,
  isThreefoldRepetition,
  legalMoves,
  materialBalance,
  moveToString,
  outcome,
  parseFEN,
  parseSquare,
  perft,
  pseudoLegalMoves,
  squareName,
  type Move,
  type State,
  KNIGHT,
  QUEEN,
} from './engine'

// A deterministic RNG for AI tests (mulberry32, byte-identical to the template).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const findMove = (state: State, uci: string): Move | undefined =>
  legalMoves(state).find((m) => moveToString(m) === uci)

// ── PERFT — the acceptance gate for move-gen correctness ────────────────────
describe('perft (startpos) — EXACT node counts', () => {
  const start = createGame()
  it('depth 1 = 20', () => expect(perft(start, 1)).toBe(20))
  it('depth 2 = 400', () => expect(perft(start, 2)).toBe(400))
  it('depth 3 = 8902', () => expect(perft(start, 3)).toBe(8902))
  it('depth 4 = 197281', () => expect(perft(start, 4)).toBe(197281))
})

describe('perft (Kiwipete) — castling/ep/promotion/checks', () => {
  const kiwipete = parseFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
  it('depth 1 = 48', () => expect(perft(kiwipete, 1)).toBe(48))
  it('depth 2 = 2039', () => expect(perft(kiwipete, 2)).toBe(2039))
  it('depth 3 = 97862', () => expect(perft(kiwipete, 3)).toBe(97862))
})

describe('perft — extra tricky positions (known values)', () => {
  it('position 3 (endgame) d1=14, d2=191, d3=2812', () => {
    const p = parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')
    expect(perft(p, 1)).toBe(14)
    expect(perft(p, 2)).toBe(191)
    expect(perft(p, 3)).toBe(2812)
  })
  it('position 4 (promotions) d1=6, d2=264', () => {
    const p = parseFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1')
    expect(perft(p, 1)).toBe(6)
    expect(perft(p, 2)).toBe(264)
  })
  it('position 5 d1=44, d2=1486', () => {
    const p = parseFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8')
    expect(perft(p, 1)).toBe(44)
    expect(perft(p, 2)).toBe(1486)
  })
})

// ── FEN round-trip ──────────────────────────────────────────────────────────
describe('FEN', () => {
  it('round-trips the starting position', () => {
    expect(exportFEN(parseFEN(START_FEN))).toBe(START_FEN)
  })
  it('round-trips Kiwipete', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'
    expect(exportFEN(parseFEN(fen))).toBe(fen)
  })
  it('round-trips an en-passant target', () => {
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
    expect(exportFEN(parseFEN(fen))).toBe(fen)
  })
  it('parses side to move and castling rights', () => {
    const s = parseFEN('8/8/8/8/8/8/8/4K2R b K - 5 9')
    expect(s.turn).toBe('b')
    expect(s.half).toBe(5)
    expect(s.full).toBe(9)
  })
  it('squareName/parseSquare are inverse', () => {
    for (const name of ['a1', 'h1', 'e4', 'd5', 'h8', 'a8']) {
      expect(squareName(parseSquare(name))).toBe(name)
    }
  })
})

// ── Basic legality ────────────────────────────────────────────────────────
describe('starting position legal moves', () => {
  const s = createGame()
  it('has 20 legal moves', () => expect(legalMoves(s).length).toBe(20))
  it('includes e2e4 and the two-square knight jumps', () => {
    const uci = legalMoves(s).map(moveToString)
    expect(uci).toContain('e2e4')
    expect(uci).toContain('e2e3')
    expect(uci).toContain('g1f3')
    expect(uci).toContain('b1c3')
  })
  it('white is not in check at the start', () => {
    expect(isInCheck(s, 'w')).toBe(false)
    expect(isInCheck(s, 'b')).toBe(false)
  })
})

describe('legalMoves never leaves own king in check', () => {
  const positions = [
    START_FEN,
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
    '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1', // king pinned laterally by rook on file
  ]
  it('filters out every move that exposes the king', () => {
    for (const fen of positions) {
      const s = parseFEN(fen)
      for (const m of legalMoves(s)) {
        const next = applyMove(s, m)
        expect(isInCheck(next, s.turn)).toBe(false)
      }
    }
  })
  it('a pinned piece cannot move off the pin line', () => {
    // White king e1, white rook e2, black rook e8: the rook on e2 is pinned.
    const s = parseFEN('4r3/8/8/8/8/8/4R3/4K3 w - - 0 1')
    const uci = legalMoves(s).map(moveToString)
    expect(uci).not.toContain('e2a2') // moving off the file exposes the king
    expect(uci).toContain('e2e7') // sliding along the pin is fine
    expect(uci).toContain('e2e8') // capturing the pinner is fine
  })
})

// ── Castling ───────────────────────────────────────────────────────────────
describe('castling', () => {
  it('generates both castles when legal', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const uci = legalMoves(s).map(moveToString)
    expect(uci).toContain('e1g1') // king-side
    expect(uci).toContain('e1c1') // queen-side
  })
  it('applying king-side castle moves the rook too', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const m = findMove(s, 'e1g1')!
    const next = applyMove(s, m)
    expect(next.board[parseSquare('g1')]).toBe(6) // white king
    expect(next.board[parseSquare('f1')]).toBe(4) // white rook
    expect(next.board[parseSquare('h1')]).toBe(0)
    expect(next.board[parseSquare('e1')]).toBe(0)
  })
  it('applying queen-side castle moves the rook too', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const next = applyMove(s, findMove(s, 'e1c1')!)
    expect(next.board[parseSquare('c1')]).toBe(6)
    expect(next.board[parseSquare('d1')]).toBe(4)
    expect(next.board[parseSquare('a1')]).toBe(0)
  })
  it('cannot castle through an attacked square', () => {
    // Black rook on f8 attacks f1, so white cannot castle king-side.
    const s = parseFEN('r4rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1')
    const uci = legalMoves(s).map(moveToString)
    expect(uci).not.toContain('e1g1')
    expect(uci).toContain('e1c1') // queen-side path (d1,c1) is clear
  })
  it('cannot castle while in check', () => {
    const s = parseFEN('4r3/8/8/8/8/8/8/R3K2R w KQ - 0 1') // rook on e8 checks king
    const uci = legalMoves(s).map(moveToString)
    expect(uci).not.toContain('e1g1')
    expect(uci).not.toContain('e1c1')
  })
  it('cannot castle into check (landing square attacked)', () => {
    // Black rook on g8 attacks g1 — king may not land there.
    const s = parseFEN('r5r1/8/8/8/8/8/8/R3K2R w KQ - 0 1')
    expect(legalMoves(s).map(moveToString)).not.toContain('e1g1')
  })
  it('cannot castle after the king has moved (no rights)', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1')
    const uci = legalMoves(s).map(moveToString)
    expect(uci).not.toContain('e1g1')
    expect(uci).not.toContain('e1c1')
  })
  it('king-side rights lost only once the h1 rook moves', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1')
    const after = applyMove(s, findMove(s, 'h1g1')!)
    expect(after.castling & 1).toBe(0) // CR_WK cleared
    expect(after.castling & 2).toBe(2) // CR_WQ intact
  })
  it('cannot castle when a piece blocks the path', () => {
    const s = parseFEN('r3k2r/8/8/8/8/8/8/R2QK2R w KQkq - 0 1') // queen on d1 blocks queen-side
    const uci = legalMoves(s).map(moveToString)
    expect(uci).not.toContain('e1c1')
    expect(uci).toContain('e1g1')
  })
})

// ── En passant ────────────────────────────────────────────────────────────
describe('en passant', () => {
  it('double push sets the ep target', () => {
    const s = createGame()
    const next = applyMove(s, findMove(s, 'e2e4')!)
    expect(next.ep).toBe(parseSquare('e3'))
  })
  it('captures en passant and removes the passed pawn', () => {
    // White pawn e5, black plays d7d5, white captures e5xd6 e.p.
    const s = parseFEN('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')
    const ep = findMove(s, 'e5d6')!
    expect(ep.flag).toBe('ep')
    const next = applyMove(s, ep)
    expect(next.board[parseSquare('d6')]).toBe(1) // white pawn arrived
    expect(next.board[parseSquare('d5')]).toBe(0) // black pawn removed
    expect(next.board[parseSquare('e5')]).toBe(0)
  })
  it('the ep target expires after one move', () => {
    const s = parseFEN('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3')
    // White makes a non-capturing move; the ep chance is gone.
    const next = applyMove(s, findMove(s, 'a2a3')!)
    expect(next.ep).toBe(-1)
    expect(legalMoves(next).map(moveToString)).not.toContain('e5d6')
  })
  it('an en-passant capture that exposes the king is illegal (the classic ep pin)', () => {
    // White Ka5, Pc5; black rook h5, black pawn d5 (ep target d6). Taking c5xd6
    // vacates BOTH c5 and d5 on rank 5, unmasking the rook's check on the king.
    const s = parseFEN('8/8/8/K1Pp3r/8/8/8/7k w - d6 0 1')
    expect(legalMoves(s).map(moveToString)).not.toContain('c5d6')
  })
})

// ── Promotion ─────────────────────────────────────────────────────────────
describe('promotion', () => {
  it('a pawn reaching the last rank generates exactly four promotions', () => {
    const s = parseFEN('8/P7/8/8/8/8/8/k6K w - - 0 1')
    const promos = legalMoves(s).filter((m) => m.from === parseSquare('a7'))
    expect(promos.length).toBe(4)
    expect(promos.map((m) => m.promotion).sort()).toEqual([KNIGHT, 3, 4, QUEEN].sort())
    expect(legalMoves(s).map(moveToString)).toContain('a7a8q')
  })
  it('applies the chosen promotion piece', () => {
    const s = parseFEN('8/P7/8/8/8/8/8/k6K w - - 0 1')
    const q = legalMoves(s).find((m) => moveToString(m) === 'a7a8q')!
    const next = applyMove(s, q)
    expect(next.board[parseSquare('a8')]).toBe(5) // white queen
  })
  it('capture-promotion works', () => {
    const s = parseFEN('1n5k/P7/8/8/8/8/8/7K w - - 0 1')
    expect(legalMoves(s).map(moveToString)).toContain('a7b8q')
  })
})

// ── Check / checkmate / stalemate ──────────────────────────────────────────
describe('check, checkmate, stalemate', () => {
  it("detects fool's mate", () => {
    // 1. f3 e5 2. g4 Qh4# — black queen mates.
    const s = parseFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    expect(isInCheck(s, 'w')).toBe(true)
    expect(isCheckmate(s)).toBe(true)
    expect(legalMoves(s).length).toBe(0)
    expect(outcome(s)).toBe('checkmate')
  })
  it("detects scholar's mate", () => {
    // Qxf7#: black king mated on the back rank.
    const s = parseFEN('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4')
    expect(isCheckmate(s)).toBe(true)
  })
  it('detects a classic stalemate (black to move, no legal move, not in check)', () => {
    const s = parseFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
    expect(isInCheck(s, 'b')).toBe(false)
    expect(isStalemate(s)).toBe(true)
    expect(legalMoves(s).length).toBe(0)
    expect(outcome(s)).toBe('stalemate')
  })
  it('a normal midgame position is neither mate nor stalemate', () => {
    const s = createGame()
    expect(isCheckmate(s)).toBe(false)
    expect(isStalemate(s)).toBe(false)
    expect(outcome(s)).toBe(null)
  })
  it('back-rank mate is detected', () => {
    const s = parseFEN('6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1')
    // Not yet mate; set up the mating position instead:
    const mated = parseFEN('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1')
    expect(isCheckmate(mated)).toBe(true)
    expect(isCheckmate(s)).toBe(false)
  })
})

// ── Draws ──────────────────────────────────────────────────────────────────
describe('draws', () => {
  it('K vs K is insufficient material', () => {
    expect(isInsufficientMaterial(parseFEN('8/8/4k3/8/8/4K3/8/8 w - - 0 1'))).toBe(true)
  })
  it('K+N vs K is insufficient material', () => {
    expect(isInsufficientMaterial(parseFEN('8/8/4k3/8/8/4KN2/8/8 w - - 0 1'))).toBe(true)
  })
  it('K+B vs K is insufficient material', () => {
    expect(isInsufficientMaterial(parseFEN('8/8/4k3/8/8/4KB2/8/8 w - - 0 1'))).toBe(true)
  })
  it('K+B vs K+B with same-colour bishops is a draw', () => {
    // Bc6 (light) and Bc4 (light) — same square colour.
    expect(isInsufficientMaterial(parseFEN('4k3/8/2b5/8/2B5/8/8/4K3 w - - 0 1'))).toBe(true)
  })
  it('K+B vs K+B with opposite-colour bishops is NOT auto-insufficient', () => {
    // Bc6 (light) and Bc3 (dark) — opposite square colours.
    expect(isInsufficientMaterial(parseFEN('4k3/8/2b5/8/8/2B5/8/4K3 w - - 0 1'))).toBe(false)
  })
  it('a lone pawn is sufficient material', () => {
    expect(isInsufficientMaterial(parseFEN('8/4p3/4k3/8/8/4K3/8/8 w - - 0 1'))).toBe(false)
  })
  it('50-move rule triggers a draw at 100 halfmoves', () => {
    const s = parseFEN('8/8/4k3/8/8/4K3/8/5R2 w - - 100 80')
    expect(isDraw(s)).toBe(true)
  })
  it('detects threefold repetition', () => {
    let s = parseFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1')
    // Shuffle both kings back and forth to repeat the position three times.
    const seq = ['e1e2', 'e8e7', 'e2e1', 'e7e8', 'e1e2', 'e8e7', 'e2e1', 'e7e8']
    for (const uci of seq) {
      const m = legalMoves(s).find((x) => moveToString(x) === uci)!
      s = applyMove(s, m)
    }
    expect(isThreefoldRepetition(s)).toBe(true)
  })
})

// ── isSquareAttacked ────────────────────────────────────────────────────────
describe('isSquareAttacked', () => {
  it('detects knight, bishop, rook, pawn and king attacks', () => {
    const s = parseFEN('8/8/8/3n4/8/8/8/8 w - - 0 1')
    expect(isSquareAttacked(s.board, parseSquare('e3'), 'b')).toBe(true) // knight d5 -> e3
    const pawn = parseFEN('8/8/8/8/4p3/8/8/8 w - - 0 1')
    expect(isSquareAttacked(pawn.board, parseSquare('d3'), 'b')).toBe(true)
    expect(isSquareAttacked(pawn.board, parseSquare('f3'), 'b')).toBe(true)
    expect(isSquareAttacked(pawn.board, parseSquare('e3'), 'b')).toBe(false) // pawns don't attack forward
  })
})

// ── AI ──────────────────────────────────────────────────────────────────────
describe('AI (bestMove)', () => {
  const rng = mulberry32(12345)

  it('returns a legal move from the start for every difficulty', () => {
    const s = createGame()
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const m = bestMove(s, d, mulberry32(1))!
      expect(legalMoves(s).some((x) => moveToString(x) === moveToString(m))).toBe(true)
    }
  })
  it('is deterministic given the same rng seed', () => {
    const s = createGame()
    const a = bestMove(s, 'hard', mulberry32(42))!
    const b = bestMove(s, 'hard', mulberry32(42))!
    expect(moveToString(a)).toBe(moveToString(b))
  })
  it('finds mate in one (hard)', () => {
    // White: Qh5 and Bc4 aiming f7; Qxf7# is mate. Position before the mate:
    const s = parseFEN('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1')
    const m = bestMove(s, 'hard', rng)!
    const next = applyMove(s, m)
    expect(isCheckmate(next)).toBe(true)
  })
  it('finds mate in one (medium)', () => {
    const s = parseFEN('r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1')
    const next = applyMove(s, bestMove(s, 'medium', rng)!)
    expect(isCheckmate(next)).toBe(true)
  })
  it('grabs free material (captures a hanging queen)', () => {
    // Black queen e4 pins the white rook e3 to the king e1; Rxe4 wins the queen.
    const s = parseFEN('4k3/8/8/8/4q3/4R3/8/4K3 w - - 0 1')
    const m = bestMove(s, 'medium', rng)!
    expect(moveToString(m)).toBe('e3e4')
    expect(m.captured).not.toBe(0) // takes the queen
  })
  it('returns null in a terminal (checkmated) position', () => {
    const s = parseFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')
    expect(bestMove(s, 'hard', rng)).toBe(null)
  })
})

// ── Evaluation & display helpers ────────────────────────────────────────────
describe('evaluation & helpers', () => {
  it('the starting position is materially balanced', () => {
    expect(materialBalance(createGame().board)).toBe(0)
    expect(evaluateWhite(createGame().board)).toBe(0)
  })
  it('material balance reflects a missing black queen', () => {
    const s = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(materialBalance(s.board)).toBe(900)
  })
  it('capturedPieces reports the queen black is missing', () => {
    const s = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(capturedPieces(s.board).black).toContain(QUEEN)
  })
  it('applyMove does not mutate the input state', () => {
    const s = createGame()
    const before = exportFEN(s)
    applyMove(s, findMove(s, 'e2e4')!)
    expect(exportFEN(s)).toBe(before)
  })
  it('pseudoLegalMoves is a superset of legalMoves', () => {
    const s = parseFEN('4r3/8/8/8/8/8/4R3/4K3 w - - 0 1')
    expect(pseudoLegalMoves(s).length).toBeGreaterThanOrEqual(legalMoves(s).length)
  })
})
