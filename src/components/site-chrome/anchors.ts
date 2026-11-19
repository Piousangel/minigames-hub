// 홈 GameBrowser 앵커 id. 클라이언트 컴포넌트(GameBrowser·HeaderSearchLink)가 쓰므로
// registry를 끌고 오는 chromeLinks와 분리해 둔다(클라이언트 번들에 게임 목록이 섞이지 않게).
export const SEARCH_ANCHOR = 'search'
export const ALL_GAMES_ANCHOR = 'all-games'
