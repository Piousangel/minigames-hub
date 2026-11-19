/**
 * 인앱 브라우저(메신저·SNS 앱 안의 웹뷰) 판별 — 순수 함수, UA 문자열만 본다.
 * 웹뷰는 그리다 화면이 밀리거나 저장소가 앱마다 따로 놀아서, 안내 문구(다른 브라우저로 열기)를 띄우는 데 쓴다.
 * 규칙은 위에서부터 먼저 맞는 것을 고른다(한 UA에 여러 토큰이 섞일 수 있다).
 */
export type InAppBrowser = 'kakaotalk' | 'instagram' | 'facebook' | 'naver' | 'line' | 'daum' | 'everytime' | 'band' | 'wechat' | 'tiktok'

const RULES: [InAppBrowser, RegExp][] = [
  ['kakaotalk', /KAKAOTALK/i],
  ['instagram', /\bInstagram\b/i],
  ['facebook', /FBAN\/|FBAV\/|FB_IAB\//],
  // 네이버 앱: 'NAVER(inapp; search; ...)' 또는 'NAVER/x.y'. 대문자 토큰으로 한정한다
  ['naver', /NAVER\(inapp|\bNAVER\//],
  ['line', /\bLine\/\d/],
  ['daum', /DaumApps/i],
  ['everytime', /everytimeApp/i],
  ['band', /\bBAND\/\d/],
  ['wechat', /MicroMessenger/i],
  ['tiktok', /musical_ly|BytedanceWebview|\bTikTok\b/i],
]

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null
  for (const [name, re] of RULES) if (re.test(ua)) return name
  return null
}
