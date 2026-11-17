'use client'

import { useEffect, useRef, useState } from 'react'
import { sendHit } from '@/lib/hit'
import { facebookSharerUrl, shareText, tagShareUrl, threadsIntentUrl, type ShareChannel } from '@/lib/share'
import { siteConfig } from '@/lib/siteConfig'

const btn =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-white/15 bg-surface px-3 py-2 text-sm font-semibold text-fg transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * 게임 공유 줄: Threads · Facebook · KakaoTalk · Instagram · 링크 복사 (+ 지원 기기는 시스템 공유).
 * 외부 스크립트 없음. KakaoTalk·Instagram은 웹 공유 링크가 없어 시스템 공유창(여기에 앱이 뜬다)을 쓰고, 안 되면 링크를 복사한다.
 */
export function ShareButtons({ slug, title, description = '' }: { slug: string; title: string; description?: string }) {
  const [canNative, setCanNative] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), [])

  const base = `${siteConfig.url}/${slug}`
  const text = shareText(title, description)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = (m: string) => {
    window.clearTimeout(timer.current)
    setMsg(m)
    timer.current = window.setTimeout(() => setMsg(''), 2400)
  }
  // withText=false면 URL만(링크 복사 버튼), true면 소개 문구+URL(앱 붙여넣기용)
  const copy = async (url: string, okMsg: string, withText = true) => {
    try {
      await navigator.clipboard.writeText(withText ? `${text}\n${url}` : url)
      flash(okMsg)
    } catch {
      flash("Couldn't copy. Copy the address from your browser instead.")
    }
  }
  const viaSheetOrCopy = async (channel: ShareChannel, app: string) => {
    const url = tagShareUrl(base, channel)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (e) {
        // 사용자가 공유창을 닫은 경우(AbortError)만 조용히 끝내고, 그 밖의 실패는 복사로 넘긴다
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    await copy(url, `Link copied — paste it into ${app}`)
  }

  const go = (channel: ShareChannel) => {
    sendHit(slug, `share_${channel}`)
    if (channel === 'threads') window.open(threadsIntentUrl(text, tagShareUrl(base, 'threads')), '_blank', 'noopener,noreferrer')
    else if (channel === 'facebook') window.open(facebookSharerUrl(tagShareUrl(base, 'facebook')), '_blank', 'noopener,noreferrer')
    else if (channel === 'kakao') void viaSheetOrCopy('kakao', 'KakaoTalk')
    else if (channel === 'instagram') void viaSheetOrCopy('instagram', 'Instagram')
    else if (channel === 'native') void viaSheetOrCopy('native', 'your app')
    else void copy(tagShareUrl(base, 'copy'), 'Link copied!', false)
  }

  return (
    <section className="mt-8" aria-labelledby={`share-${slug}`} data-testid="share-buttons">
      <h2 id={`share-${slug}`} className="mb-3 text-sm font-semibold text-fg-muted">
        Share this game
      </h2>
      <div className="flex flex-wrap gap-2">
        {canNative && (
          <button type="button" className={btn} onClick={() => go('native')} data-testid="share-native">
            Share…
          </button>
        )}
        <button type="button" className={btn} onClick={() => go('threads')} data-testid="share-threads">
          Threads
        </button>
        <button type="button" className={btn} onClick={() => go('facebook')} data-testid="share-facebook">
          Facebook
        </button>
        <button type="button" className={btn} onClick={() => go('kakao')} data-testid="share-kakao">
          KakaoTalk
        </button>
        <button type="button" className={btn} onClick={() => go('instagram')} data-testid="share-instagram">
          Instagram
        </button>
        <button type="button" className={btn} onClick={() => go('copy')} data-testid="share-copy">
          Copy link
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-fg-muted">
        {msg}
      </p>
    </section>
  )
}
