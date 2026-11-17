import { useCallback, useEffect, useRef, useState } from 'react'
import type { Difficulty } from '@/lib/games/recoil/engine'
import { RecoilGame, type Mode } from './RecoilGame'
import { canOpenLeaderboard, closeApp, onBack, openLeaderboard } from './toss'
import { getSave, liveStreak, loadSave, todayKST, updateSave, type Save } from './store'
import { setMuted } from './sound'

type Screen = { name: 'home' } | { name: 'game'; mode: Mode; difficulty: Difficulty }

export function App() {
  const [ready, setReady] = useState(false)
  const [save, setSave] = useState<Save | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [howTo, setHowTo] = useState(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    void loadSave().then((s) => {
      setMuted(s.muted)
      setSave(s)
      setReady(true)
    })
  }, [])

  const goHome = useCallback(() => {
    setSave({ ...getSave() })
    setScreen({ name: 'home' })
  }, [])

  // 안드로이드 뒤로가기: 게임 중이면 홈으로, 홈이면 종료 확인
  useEffect(
    () =>
      onBack(() => {
        if (screenRef.current.name === 'game') goHome()
        else setConfirmExit(true)
      }),
    [goHome],
  )

  const start = useCallback(
    (mode: Mode) => {
      const s = getSave()
      if (!s.seenHowTo) {
        setHowTo(true)
        void updateSave({ seenHowTo: true })
      }
      setScreen({ name: 'game', mode, difficulty })
    },
    [difficulty],
  )

  const toggleSound = useCallback(async () => {
    const next = !getSave().muted
    setMuted(next)
    setSave({ ...(await updateSave({ muted: next })) })
  }, [])

  if (!ready || !save) {
    return (
      <div className="screen center">
        <Logo />
      </div>
    )
  }

  const today = todayKST()
  const doneToday = save.dailyTriedDay === today
  const streak = liveStreak(save, today)

  return (
    <>
      {screen.name === 'game' ? (
        <RecoilGame mode={screen.mode} difficulty={screen.difficulty} onExit={goHome} />
      ) : (
        <div className="screen home">
          <div className="home-top">
            <button className="icon-btn" onClick={() => void toggleSound()} aria-label={save.muted ? '소리 켜기' : '소리 끄기'}>
              {save.muted ? '🔇' : '🔊'}
            </button>
          </div>
          <div className="hero">
            <Logo />
            <h1>반동 퍼즐</h1>
            <p className="muted">쏘면 반대로 밀려나요. 반동만으로 별 5개를 모아 보세요.</p>
          </div>

          <div className="card daily">
            <div className="card-head">
              <span className="chip">오늘의 퍼즐</span>
              {streak > 0 && <span className="streak">🔥 {streak}일 연속</span>}
            </div>
            <p className="card-body">
              {doneToday ? `오늘 기록 ${(save.dailyScore ?? 0).toLocaleString()}점 · 다시 해도 기록은 첫 판만 남아요` : '모두에게 같은 판이 나와요. 첫 판 점수로 랭킹이 정해져요.'}
            </p>
            <button className="btn primary block" onClick={() => start('daily')}>
              {doneToday ? '오늘의 퍼즐 다시 하기' : '오늘의 퍼즐 시작'}
            </button>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="chip ghost">연습</span>
            </div>
            <div className="seg" role="radiogroup" aria-label="난이도">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button key={d} role="radio" aria-checked={difficulty === d} className={difficulty === d ? 'on' : ''} onClick={() => setDifficulty(d)}>
                  {{ easy: '쉬움', normal: '보통', hard: '어려움' }[d]}
                </button>
              ))}
            </div>
            <button className="btn ghost block" onClick={() => start('practice')}>
              연습 시작
            </button>
          </div>

          <div className="row">
            {canOpenLeaderboard() && (
              <button className="btn ghost" onClick={() => void openLeaderboard()}>
                🏆 랭킹
              </button>
            )}
            <button className="btn ghost" onClick={() => setHowTo(true)}>
              게임 방법
            </button>
          </div>
          <p className="muted small center-text">최고 기록 {save.best.toLocaleString()}점 · {save.plays}판 플레이</p>
        </div>
      )}

      {howTo && (
        <div className="sheet-backdrop" onClick={() => setHowTo(false)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>게임 방법</h2>
            <ol className="howto">
              <li>화면을 누른 채 움직여 쏠 방향을 정해요. 점선이 앞으로 갈 길이에요.</li>
              <li>손을 떼면 발사! 우주선은 쏜 방향의 <b>반대쪽</b>으로 밀려나요.</li>
              <li>마찰이 없어서 계속 흘러가요. 진행 방향으로 쏘면 속도가 줄어요.</li>
              <li>정해진 탄약 안에 별 5개를 모두 모으면 성공. 벽에 튕겨서 먹으면 보너스!</li>
            </ol>
            <button className="btn primary block" onClick={() => setHowTo(false)}>
              알겠어요
            </button>
          </div>
        </div>
      )}

      {confirmExit && (
        <div className="sheet-backdrop">
          <div className="sheet" role="dialog" aria-modal="true">
            <h2>게임을 종료할까요?</h2>
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setConfirmExit(false)}>
                계속하기
              </button>
              <button className="btn primary" onClick={() => void closeApp()}>
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="26" cy="36" r="10" fill="rgba(34,211,238,.15)" stroke="#22d3ee" strokeWidth="3" />
      <line x1="26" y1="36" x2="42" y2="22" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
      <line x1="46" y1="18" x2="58" y2="7" stroke="#ff3d9a" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 4" />
      <path d="M14 52 l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill="#fbbf24" transform="translate(0 -10)" />
    </svg>
  )
}
