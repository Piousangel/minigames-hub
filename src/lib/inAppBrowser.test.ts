import { describe, expect, it } from 'vitest'
import { detectInAppBrowser } from './inAppBrowser'

const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36'

describe('detectInAppBrowser', () => {
  it.each([
    ['kakaotalk', `${IOS} Mobile/15E148 KAKAOTALK 10.8.5`],
    ['kakaotalk', `${AND} KAKAOTALK/10.8.5 (INAPP)`],
    ['instagram', `${IOS} Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 621716086)`],
    ['instagram', `${AND} Instagram 339.0.0.37.93 Android (34/14; 450dpi; 1080x2340; samsung; SM-S918N; dm3q; qcom; ko_KR; 621716086)`],
    ['facebook', `${IOS} Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/ko_KR;FBOP/5]`],
    ['facebook', `${AND} [FB_IAB/FB4A;FBAV/470.0.0.43.109;]`],
    ['naver', `${IOS} Mobile/15E148 NAVER(inapp; search; 2000; 12.6.3; 15PRO)`],
    ['naver', `${AND} NAVER(inapp; search; 1240; 12.7.11)`],
    ['line', `${IOS} Mobile/15E148 Safari Line/14.9.0`],
    ['line', `${AND} Line/14.9.1/IAB`],
    ['daum', `${IOS} Mobile/15E148 DaumApps/8.6.2 DaumDevice/mobile`],
    ['everytime', `${AND} everytimeApp/6.4.3`],
    ['band', `${AND} BAND/14.2.1`],
    ['wechat', `${IOS} Mobile/15E148 MicroMessenger/8.0.49(0x18003137) NetType/WIFI Language/zh_CN`],
    ['tiktok', `${AND} trill_340203 AppName/musical_ly ByteLocale/ko BytedanceWebview/d8a21c6`],
    ['tiktok', `${IOS} Mobile/15E148 TikTok 34.2.0 rv:342014 (iPhone; iOS 17.5; ko_KR) Cronet`],
  ] as const)('%s 웹뷰를 알아본다', (want, ua) => {
    expect(detectInAppBrowser(ua)).toBe(want)
  })

  it('일반 브라우저는 null', () => {
    expect(detectInAppBrowser(`${IOS} Version/17.5 Mobile/15E148 Safari/604.1`)).toBeNull() // iOS Safari
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36')).toBeNull() // Android Chrome
    expect(detectInAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')).toBeNull()
    expect(detectInAppBrowser(`${IOS} CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1`)).toBeNull() // iOS Chrome
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36')).toBeNull()
  })

  it('빈 값은 null', () => {
    expect(detectInAppBrowser('')).toBeNull()
    expect(detectInAppBrowser(undefined)).toBeNull()
  })
})
