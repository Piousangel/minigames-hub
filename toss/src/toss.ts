/**
 * 토스 SDK를 감싼 얇은 층. 토스 앱 밖(로컬 브라우저 개발)에서도 죽지 않도록 모든 호출을 try로 감싼다.
 * 체크리스트: 브릿지를 짧은 시간에 과도하게 부르지 않는다 → 점수 제출은 판이 끝날 때 1회만.
 */
import {
  Game,
  Screen,
  Storage,
  User,
  Device,
  graniteEvent,
} from '@apps-in-toss/web-framework'

/** 토스 앱 WebView 안에서 실행 중인가. 로컬 vite 개발 서버에서는 false. */
export function inToss(): boolean {
  try {
    return typeof window !== 'undefined' && 'ReactNativeWebView' in window
  } catch {
    return false
  }
}

export async function getUserKey(): Promise<string> {
  if (!inToss()) return 'local'
  try {
    const res = await User.getAnonymousKey()
    return res.hash || 'anon'
  } catch {
    return 'anon'
  }
}

export const kv = {
  async get(key: string): Promise<string | null> {
    if (inToss()) {
      try {
        return await Storage.getItem(key)
      } catch {
        // 아래 localStorage로
      }
    }
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (inToss()) {
      try {
        await Storage.setItem(key, value)
        return
      } catch {
        // 아래 localStorage로
      }
    }
    try {
      localStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
}

/** 판이 끝났을 때 1회. 실패해도 게임 흐름은 막지 않는다. 재시도는 최대 1번, 1.5초 뒤. */
export async function submitScore(score: number): Promise<void> {
  if (!inToss() || score <= 0) return
  const send = () => Game.setLeaderboardScore({ score: String(Math.floor(score)) })
  try {
    const r = await send()
    if (r && r.statusCode !== 'SUCCESS') {
      await new Promise((ok) => setTimeout(ok, 1500))
      await send()
    }
  } catch {
    // 리더보드 미설정·구버전 앱 등: 무시
  }
}

export function canOpenLeaderboard(): boolean {
  try {
    return inToss() && Game.openLeaderboard.isSupported()
  } catch {
    return false
  }
}

export async function openLeaderboard(): Promise<void> {
  try {
    await Game.openLeaderboard()
  } catch {
    // ignore
  }
}

export function haptic(type: 'tap' | 'success' | 'error'): void {
  if (!inToss()) return
  try {
    const map = { tap: 'tickWeak', success: 'success', error: 'error' } as const
    void Device.triggerHaptic({ type: map[type] })
  } catch {
    // ignore
  }
}

export function onBack(handler: () => void): () => void {
  if (!inToss()) return () => {}
  try {
    return graniteEvent.addEventListener('backEvent', { onEvent: handler, onError: () => {} })
  } catch {
    return () => {}
  }
}

export async function closeApp(): Promise<void> {
  try {
    await Screen.close()
  } catch {
    // ignore
  }
}
