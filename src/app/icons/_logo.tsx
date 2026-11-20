import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 파비콘·애플·PWA 설치 아이콘(96/180/192/512 + maskable 512 PNG) 공유 응답. 브랜드 최종판(11-20 오너 승인,
 * 3차 V2 최종판 A '밝게' — 금빛 링 엠블럼 + 말랑이)을 `src/brand/`의 PNG 그대로 낸다(빌드 때 읽음, 정적 export).
 * 원본·생성법은 `scripts/brand-icons.py`. URL(/icon·/apple-icon·/icons/pwa-*)은 예전 그대로 — 확장자 없는 경로라
 * `public/_headers`가 image/png를 붙인다.
 * `_logo`는 언더스코어 프리픽스라 라우팅되지 않는다(route.tsx들이 import만 함).
 */
export async function brandPng(file: string): Promise<Response> {
  const buf = await readFile(join(process.cwd(), 'src/brand', file))
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/png' } })
}
