'use client'

import { useEffect, useState } from 'react'
import { parsePopularRows, type PopularEntry } from '@/lib/popular'

/**
 * /api/popular(최근 14일 몰입 순 플레이어 수)를 한 번 받아 세션에 캐시한다.
 * 예전 홈 Featured 레일(FeaturedRail)의 클라이언트 로직을 그대로 옮겼다(R4: 레일은 Continue 줄의 '인기 4'로 흡수).
 * 정렬·임계·슬러그 검증은 src/lib/popular.ts rankFeatured 한 곳에서.
 */
const SESSION_KEY = 'mg:popular:v1'

function readSession(): PopularEntry[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const games = parsePopularRows({ data: JSON.parse(raw) })
    return games.length > 0 ? games : null // 빈 값은 미스 취급
  } catch {
    return null
  }
}

function writeSession(games: PopularEntry[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(games))
  } catch {
    // 프라이빗 모드 등 — 무시
  }
}

// 모듈 단위 in-flight 공유 — Strict Mode 이중 effect·동시 마운트가 요청을 한 번만 보내게.
// 성공한 비어있지 않은 결과만 세션에 캐시한다(빈/실패 결과를 캐시하면 세션 내내 재요청을 못 함).
let inflight: Promise<PopularEntry[]> | null = null

function fetchPopular(): Promise<PopularEntry[]> {
  inflight ??= fetch('/api/popular')
    .then((r) => (r.ok ? r.json() : null))
    .then((body: unknown) => {
      const games = parsePopularRows({ data: (body as { games?: unknown } | null)?.games })
      if (games.length > 0) writeSession(games)
      return games
    })
    .catch(() => [] as PopularEntry[])
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** 테스트 전용 — 모듈 in-flight 상태 초기화. */
export function __resetPopularFetchForTest(): void {
  inflight = null
}

/** 인기 목록(첫 렌더·실패·정적 e2e = []). enabled=false면 요청하지 않는다(최근 플레이가 있어 쓸 일이 없을 때). */
export function usePopular(enabled = true): PopularEntry[] {
  const [popular, setPopular] = useState<PopularEntry[]>([])
  useEffect(() => {
    if (!enabled) return
    const cached = readSession()
    if (cached) {
      setPopular(cached)
      return
    }
    let cancelled = false
    void fetchPopular().then((games) => {
      if (!cancelled) setPopular(games)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return popular
}
