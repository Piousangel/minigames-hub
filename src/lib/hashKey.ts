/**
 * 레이트리밋 키용 해시. 예전엔 D1에 원본 IP를 그대로 저장했다(개인정보). SHA-256 앞 24자(hex)만 쓴다.
 * salt는 선택 시크릿(RATE_SALT)이 있으면 섞는다 — 시크릿이 없으면 IPv4 전수 대입으로 되돌릴 수 있으니
 * '원본을 그대로 보관하지 않는다' 수준의 보호이고, 강한 비식별은 시크릿을 설정해야 한다.
 */
export async function hashKey(value: string, salt = ''): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${value}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
