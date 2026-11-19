/**
 * Daily 게임의 "오늘" 단일 진실 소스.
 *
 * 전 게임이 이 헬퍼 하나만 쓴다. 예전엔 게임마다 제각각이었다 — 일부는 UTC
 * (`toISOString`), 일부는 로컬(`getFullYear`) — 그래서 daily 판이 게임마다 다른
 * 시각에 갱신됐다. 주간 리더보드가 이미 UTC 주(週)를 쓰므로(leaderboard.ts) 여기에
 * 맞춰 **UTC 자정**을 하루 경계로 삼는다. 그래야 전 세계 플레이어가 같은 순간에
 * 같은 daily 판을 받고, day streak도 timezone에 흔들리지 않는다.
 *
 * 순수성: 이 함수는 `new Date()`를 읽으므로 impure다 — 반드시 **컴포넌트 층에서만**
 * 호출하고, 결과 문자열을 순수 엔진의 `dailySeed()`에 넘긴다. 엔진은 이 파일을
 * import하지 않는다.
 */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD' (UTC)
}

/**
 * 사용자 현지 날짜('YYYY-MM-DD'). 나라별로 각자의 자정에 일일이 바뀌어야 하는 게임용(말랑 미끄럼길, 오너 11-19).
 * 같은 순간에 나라마다 다른 날의 판을 받으므로 전 세계 같은 판 비교는 안 되고, 그 대신 아침 9시(한국)처럼 어색한 시각에 판이 바뀌지 않는다.
 * 다른 일일 게임은 아직 todayUTC()를 쓴다(주간 리더보드 UTC 주와 맞추기 위함).
 */
export function todayLocal(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

