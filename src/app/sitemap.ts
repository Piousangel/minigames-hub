import type { MetadataRoute } from 'next'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteConfig.url, changeFrequency: 'daily', priority: 1 },
    { url: `${siteConfig.url}/daily`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteConfig.url}/leaderboards`, changeFrequency: 'daily', priority: 0.7 },
    ...['puzzle', 'arcade', 'classic', 'skill'].map((c) => ({
      url: `${siteConfig.url}/category/${c}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
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
