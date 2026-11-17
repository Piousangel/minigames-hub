import { useCallback, useEffect, useRef, useState } from 'react'
import type { Difficulty } from '@/lib/games/recoil/engine'
import { RecoilGame, type Mode } from './RecoilGame'
import { canOpenLeaderboard, closeApp, onBack, openLeaderboard } from './toss'
import { getSave, liveStreak, loadSave, todayKST, updateSave, type Save } from './store'
import { setMuted } from './sound'
import { Mascot } from './Mascot'
import { CHARACTERS, charById, isUnlocked, josa, preloadSprites, spriteUrl, unlockedIds, type Character } from './characters'

type Screen = { name: 'home' } | { name: 'game'; mode: Mode; difficulty: Difficulty }
type Sheet = null | 'howto' | 'friends' | 'exit'

export function App() {
  const [save, setSave] = useState<Save | null>(null)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [sheet, setSheet] = useState<Sheet>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [tapSeq, setTapSeq] = useState(0)
  const screenRef = useRef(screen)
  screenRef.current = screen
  const sheetRef = useRef(sheet)
  sheetRef.current = sheet

  useEffect(() => {
    void loadSave().then((s) => {
      setMuted(s.muted)
      preloadSprites(unlockedIds(s))
      setSave(s)
    })
  }, [])

  const refresh = useCallback(() => setSave({ ...getSave() }), [])
  const goHome = useCallback(() => {
    refresh()
    setScreen({ name: 'home' })
  }, [refresh])

  // 안드로이드 뒤로가기: 시트 → 닫기, 게임 → 홈, 홈 → 종료 확인
  useEffect(
    () =>
      onBack(() => {
        if (sheetRef.current && sheetRef.current !== 'exit') setSheet(null)
        else if (screenRef.current.name === 'game') goHome()
        else setSheet('exit')
      }),
    [goHome],
  )

  const start = useCallback(
    (mode: Mode) => {
      if (!getSave().seenHowTo) {
        setSheet('howto')
        void updateSave({ seenHowTo: true })
      }
      setScreen({ name: 'game', mode, difficulty })
    },
    [difficulty],
  )

  const toggleSound = useCallback(async () => {
    const next = !getSave().muted
    setMuted(next)
    await updateSave({ muted: next })
    refresh()
  }, [refresh])

  const pick = useCallback(
    async (c: Character) => {
      await updateSave({ character: c.id })
      refresh()
      setSheet(null)
    },
    [refresh],
  )

  if (!save) {
    return (
      <div className="screen center">
        <img className="boot" src={spriteUrl('tori', 'idle')} alt="" />
      </div>
    )
  }

  const today = todayKST()
  const doneToday = save.dailyTriedDay === today
  const streak = liveStreak(save, today)
  const me = charById(save.character)
  const owned = unlockedIds(save).length

  return (
    <>
      {screen.name === 'game' ? (
        <RecoilGame mode={screen.mode} difficulty={screen.difficulty} character={me} onExit={goHome} />
      ) : (
        <div className="screen home">
          <div className="starfield" aria-hidden="true" />
          <div className="home-top">
            <span className="brand">반동 퍼즐</span>
            <button className="icon-btn" onClick={() => void toggleSound()} aria-label={save.muted ? '소리 켜기' : '소리 끄기'}>
              {save.muted ? '🔇' : '🔊'}
            </button>
          </div>

          <button className="stage" onClick={() => setTapSeq((n) => n + 1)} aria-label={`${me.name} 쓰다듬기`}>
            <span className="orbit" aria-hidden="true" />
            <span className="float-wrap">
              <Mascot id={me.id} pose={tapSeq % 3 === 2 ? 'happy' : 'idle'} size={210} fireSeq={tapSeq} />
            </span>
          </button>
          <div className="hello">
            <b>{me.name}</b>
            <span>{me.species} · {me.shot}로 날아요</span>
          </div>

          <div className="card daily">
            <div className="card-head">
              <span className="chip">오늘의 퍼즐 {today.slice(5).replace('-', '/')}</span>
              {streak > 0 && <span className="streak">🔥 {streak}일 연속</span>}
            </div>
            <p className="card-body">
              {doneToday
                ? `오늘 기록 ${(save.dailyScore ?? 0).toLocaleString()}점 · 다시 해도 랭킹은 첫 판만 남아요`
                : '모두에게 같은 판이 나와요. 첫 판 점수로 토스 친구들과 겨뤄요.'}
            </p>
            <button className="btn primary block" onClick={() => start('daily')}>
              {doneToday ? '오늘의 퍼즐 다시 하기' : '오늘의 퍼즐 시작'}
            </button>
          </div>

          <div className="card">
            <div className="seg" role="radiogroup" aria-label="연습 난이도">
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
            <button className="btn ghost tile" onClick={() => setSheet('friends')}>
              <span className="tile-ic">🐿️</span>우주 친구들 <small>{owned}/{CHARACTERS.length}</small>
            </button>
            {canOpenLeaderboard() && (
              <button className="btn ghost tile" onClick={() => void openLeaderboard()}>
                <span className="tile-ic">🏆</span>랭킹
              </button>
            )}
            <button className="btn ghost tile" onClick={() => setSheet('howto')}>
              <span className="tile-ic">❔</span>방법
            </button>
          </div>
          <p className="muted small center-text">
            최고 {save.best.toLocaleString()}점 · 모은 별 {save.totalStars}개 · {save.plays}판
          </p>
        </div>
      )}

      {sheet === 'howto' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <img className="sheet-hero" src={spriteUrl(me.id, 'fire')} alt="" />
            <h2>이렇게 날아요</h2>
            <ol className="howto">
              <li>화면을 누른 채 움직여 쏠 방향을 정해요. 점선이 앞으로 갈 길이에요.</li>
              <li>손을 떼면 발사! {josa(me.name, '은', '는')} 쏜 방향의 <b>반대쪽</b>으로 밀려나요.</li>
              <li>우주엔 마찰이 없어요. 가는 방향으로 한 번 더 쏘면 멈출 수 있어요.</li>
              <li>정해진 발 수 안에 별 5개를 모두 모으면 성공. 벽에 튕겨 먹으면 보너스!</li>
            </ol>
            <button className="btn primary block" onClick={() => setSheet(null)}>
              알겠어요
            </button>
          </div>
        </div>
      )}

      {sheet === 'friends' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet tall" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>우주 친구들</h2>
            <p className="muted small">모두 꾸미기용이라 실력과 랭킹엔 영향이 없어요. 플레이로만 만날 수 있어요.</p>
            <div className="friends">
              {CHARACTERS.map((c) => {
                const open = isUnlocked(c, save)
                const [v, goal] = c.unlock ? c.unlock.progress(save) : [1, 1]
                const sel = save.character === c.id
                return (
                  <button
                    key={c.id}
                    className={`friend ${open ? '' : 'locked'} ${sel ? 'sel' : ''}`}
                    disabled={!open}
                    onClick={() => void pick(c)}
                    style={{ ['--acc' as string]: c.accent }}
                  >
                    <img src={spriteUrl(c.id, 'idle')} alt="" />
                    <b>{open ? c.name : '???'}</b>
                    {open ? (
                      <span>{sel ? '함께하는 중' : c.species}</span>
                    ) : (
                      <>
                        <span>{c.unlock!.label}</span>
                        <i className="bar">
                          <i style={{ width: `${Math.min(100, (v / goal) * 100)}%` }} />
                        </i>
                        <span className="num">
                          {Math.min(v, goal)}/{goal}
                        </span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
            <p className="intro">“{me.intro}”</p>
          </div>
        </div>
      )}

      {sheet === 'exit' && (
        <div className="sheet-backdrop">
          <div className="sheet" role="dialog" aria-modal="true">
            <img className="sheet-hero" src={spriteUrl(me.id, 'dizzy')} alt="" />
            <h2>벌써 가시게요?</h2>
            <p className="muted">{josa(me.name, '이가', '가')} 내일의 퍼즐에서 기다릴게요.</p>
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setSheet(null)}>
                더 할래요
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
