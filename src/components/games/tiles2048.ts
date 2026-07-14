/**
 * UI-only tile-identity adapter for 2048.
 *
 * The engine (`src/lib/games/g2048/engine.ts`) works on a plain number board
 * with no tile identity, so it cannot describe per-tile motion. This module
 * lives entirely in the component layer: it assigns stable ids to tiles and,
 * given the current tiles + a direction, computes where each tile slides and
 * which pairs merge — mirroring the engine's left-slide normalization. The
 * engine remains the source of truth for score/over/won; this only drives
 * animation.
 */
import { SIZE, type Board, type Direction } from '@/lib/games/g2048/engine'

export interface Tile {
  id: number
  value: number
  row: number
  col: number
  /** Changes to force the tile "face" to remount and replay spawn/pop. */
  animKey: string
  /** Entrance stagger delay in ms (board load / restart only). */
  enterDelay: number
}

export interface MovePlan {
  /** Final position for every current tile (dead tiles → survivor's cell). */
  positions: Map<number, { row: number; col: number }>
  /** Surviving tiles that absorbed a merge, with their doubled value. */
  merges: Array<{ survivorId: number; newValue: number }>
  /** Tiles consumed by a merge — removed after the slide completes. */
  deadIds: Set<number>
}

/** Cells of each row/column in traversal order (from the moving edge inward). */
function lineCells(dir: Direction): Array<Array<{ r: number; c: number }>> {
  const lines: Array<Array<{ r: number; c: number }>> = []
  for (let a = 0; a < SIZE; a++) {
    const line: Array<{ r: number; c: number }> = []
    for (let b = 0; b < SIZE; b++) {
      let r: number
      let c: number
      if (dir === 'left') {
        r = a
        c = b
      } else if (dir === 'right') {
        r = a
        c = SIZE - 1 - b
      } else if (dir === 'up') {
        r = b
        c = a
      } else {
        // down
        r = SIZE - 1 - b
        c = a
      }
      line.push({ r, c })
    }
    lines.push(line)
  }
  return lines
}

export function planMove(tiles: Tile[], dir: Direction): MovePlan {
  const byPos = new Map<string, Tile>()
  for (const t of tiles) byPos.set(`${t.row},${t.col}`, t)

  const positions = new Map<number, { row: number; col: number }>()
  const merges: MovePlan['merges'] = []
  const deadIds = new Set<number>()

  for (const line of lineCells(dir)) {
    const lineTiles: Tile[] = []
    for (const cell of line) {
      const t = byPos.get(`${cell.r},${cell.c}`)
      if (t) lineTiles.push(t)
    }
    let slot = 0
    let prev: { tile: Tile; slotIdx: number; merged: boolean } | null = null
    for (const tile of lineTiles) {
      if (prev && !prev.merged && prev.tile.value === tile.value) {
        const cell = line[prev.slotIdx]
        positions.set(tile.id, { row: cell.r, col: cell.c })
        deadIds.add(tile.id)
        merges.push({ survivorId: prev.tile.id, newValue: prev.tile.value * 2 })
        prev.merged = true
      } else {
        const cell = line[slot]
        positions.set(tile.id, { row: cell.r, col: cell.c })
        prev = { tile, slotIdx: slot, merged: false }
        slot++
      }
    }
  }
  return { positions, merges, deadIds }
}

/** Build a fresh tile list from a board (initial load / restart / reduced-motion). */
export function tilesFromBoard(board: Board, nextId: () => number, stagger: boolean): Tile[] {
  const tiles: Tile[] = []
  let idx = 0
  board.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v > 0) {
        tiles.push({ id: nextId(), value: v, row: r, col: c, animKey: 's', enterDelay: stagger ? idx * 45 : 0 })
        idx++
      }
    }),
  )
  return tiles
}

/** Locate the single cell the engine spawned (differs between pre/post spawn). */
export function findSpawn(before: Board, after: Board): { row: number; col: number; value: number } | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (before[r][c] === 0 && after[r][c] !== 0) return { row: r, col: c, value: after[r][c] }
    }
  }
  return null
}
