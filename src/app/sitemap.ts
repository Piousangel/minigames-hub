import type { MetadataRoute } from 'next'
import { gamePages } from '@/lib/games/registry'
import { siteConfig } from '@/lib/siteConfig'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ['', '/about', '/privacy', '/terms', '/contact']
  return [
    ...staticPaths.map((p) => ({ url: `${siteConfig.url}${p}`, changeFrequency: 'monthly' as const })),
    ...gamePages.map((g) => ({
      url: `${siteConfig.url}/${g.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
