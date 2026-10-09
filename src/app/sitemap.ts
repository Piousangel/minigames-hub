import type { MetadataRoute } from 'next'
import { gamePages } from '@/lib/games/registry'
import { COLLECTION_SLUGS } from '@/lib/games/collections'
import { siteConfig } from '@/lib/siteConfig'
import { allContent } from '@/content'

export const dynamic = 'force-static'

/**
 * 얇은 목록/허브 페이지 — siteConfig.thinPagesNoindex가 켜져 있으면(AdSense 심사 기간)
 * 해당 페이지들이 robots noindex이므로 sitemap에서도 뺀다. 플래그를 false로 돌리면 복구.
 */
function thinListPages(): MetadataRoute.Sitemap {
  return [
    { url: `${siteConfig.url}/collections`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${siteConfig.url}/unblocked`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteConfig.url}/leaderboards`, changeFrequency: 'daily', priority: 0.7 },
    ...['puzzle', 'arcade', 'classic', 'skill'].map((c) => ({
      url: `${siteConfig.url}/category/${c}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...COLLECTION_SLUGS.map((c) => ({
      url: `${siteConfig.url}/collection/${c}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, changeFrequency: 'daily', priority: 1 },
    { url: `${siteConfig.url}/daily`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteConfig.url}/guides`, changeFrequency: 'weekly', priority: 0.8 },
    ...allContent().map((c) => ({
      url: `${siteConfig.url}/guides/${c.entry.slug}`,
      lastModified: c.type === 'guide' ? c.entry.updated : c.entry.published,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...(siteConfig.thinPagesNoindex ? [] : thinListPages()),
    ...gamePages.map((g) => ({
      url: `${siteConfig.url}/${g.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...['/about', '/privacy', '/terms', '/contact'].map((p) => ({
      url: `${siteConfig.url}${p}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ]
}
