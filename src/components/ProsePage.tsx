import type { ReactNode } from 'react'
import { GardenHubHead, GardenHubPage, GardenProse, type HubArt } from '@/components/garden-hub/GardenHub'

/**
 * 글 페이지(/about·/privacy·/terms·/contact) — 리디자인 v2 R9 정원 틀. 머리 + 읽기 우선 본문(GardenProse).
 * 마스코트는 역할이 맞는 곳에만(About = 안내 해씨, Contact = 우체부 보미), 약관 두 쪽은 글만.
 */
export function ProsePage({
  page,
  title,
  kicker,
  art,
  children,
}: {
  page: string
  title: string
  kicker?: ReactNode
  art?: HubArt
  children: ReactNode
}) {
  return (
    <GardenHubPage page={page} width="prose">
      <GardenHubHead kicker={kicker} title={title} art={art} />
      <GardenProse>{children}</GardenProse>
    </GardenHubPage>
  )
}
