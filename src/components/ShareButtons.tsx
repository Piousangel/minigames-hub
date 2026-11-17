'use client'

import { useEffect, useRef, useState } from 'react'
import { sendHit } from '@/lib/hit'
import { facebookSharerUrl, shareText, tagShareUrl, threadsIntentUrl, type ShareChannel } from '@/lib/share'
import { siteConfig } from '@/lib/siteConfig'

const btn =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-white/15 bg-surface px-3 py-2 text-sm font-semibold text-fg transition-colors hover:border-accent/60 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** 클립보드 API가 막힌 환경(인앱 브라우저·권한 거부)용 폴백: 숨은 textarea + execCommand. */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/**
 * 게임 공유 줄: Threads · Facebook · KakaoTalk · Instagram · 링크 복사 (+ 지원 기기는 시스템 공유).
 * 외부 스크립트 없음. Threads·Facebook은 진짜 링크(<a target=_blank>)라 카카오톡 같은 인앱 브라우저·팝업 차단에서도 열린다.
 * KakaoTalk·Instagram은 웹 공유 링크가 없어 시스템 공유창(앱 선택)을 쓰고, 안 되면 복사하고, 복사도 안 되면 링크를 화면에 보여 준다.
 */
export function ShareButtons({ slug, title, description = '' }: { slug: string; title: string; description?: string }) {
  const [canNative, setCanNative] = useState(false)
  const [msg, setMsg] = useState('')
  const [manual, setManual] = useState('') // 자동 복사가 모두 실패했을 때 직접 복사하도록 보여 주는 링크
  useEffect(() => setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), [])

  const base = `${siteConfig.url}/${slug}`
  const text = shareText(title, description)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = (m: string) => {
    window.clearTimeout(timer.current)
    setMsg(m)
    timer.current = window.setTimeout(() => setMsg(''), 3500)
  }
  // withText=false면 URL만(링크 복사 버튼), true면 소개 문구+URL(앱 붙여넣기용)
  const copy = async (url: string, okMsg: string, withText = true) => {
    const payload = withText ? `${text}\n${url}` : url
    let ok = false
    try {
      await navigator.clipboard.writeText(payload)
      ok = true
    } catch {
      ok = legacyCopy(payload)
    }
    if (ok) {
      setManual('')
      flash(okMsg)
    } else {
      setManual(url) // 마지막 수단: 링크를 보여 줘서 길게 눌러 복사하게 한다
      flash('자동 복사가 막혀 있어요. 아래 링크를 길게 눌러 복사해 주세요.')
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
    await copy(url, `링크를 복사했어요 — ${app}에 붙여넣어 주세요`)
  }

  const go = (channel: ShareChannel) => {
    sendHit(slug, `share_${channel}`)
    if (channel === 'kakao') void viaSheetOrCopy('kakao', '카카오톡')
    else if (channel === 'instagram') void viaSheetOrCopy('instagram', '인스타그램')
    else if (channel === 'native') void viaSheetOrCopy('native', '앱')
    else if (channel === 'copy') void copy(tagShareUrl(base, 'copy'), '링크를 복사했어요!', false)
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
        <a
          className={btn}
          href={threadsIntentUrl(text, tagShareUrl(base, 'threads'))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sendHit(slug, 'share_threads')}
          data-testid="share-threads"
        >
          Threads
        </a>
        <a
          className={btn}
          href={facebookSharerUrl(tagShareUrl(base, 'facebook'))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sendHit(slug, 'share_facebook')}
          data-testid="share-facebook"
        >
          Facebook
        </a>
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
      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm ${msg ? 'font-semibold text-accent' : 'text-fg-muted'}`}>
        {msg}
      </p>
      {manual && (
        <input
          readOnly
          value={manual}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-lg border border-white/15 bg-surface px-3 py-2 text-xs text-fg"
          aria-label="Link to copy"
          data-testid="share-manual"
        />
      )}
    </section>
  )
}
