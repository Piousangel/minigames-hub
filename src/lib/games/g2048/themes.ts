export interface Theme2048 {
  key: string
  tiles: Record<number, string> // 타일 값 → 표시 문자(숫자 또는 이모지)
  /** 선택: 타일 값 → 이름(Mouse…Dragon). 있으면 결과 오버레이에 '도달한 동물' 줄과 역대 최고 타일(bestTile:<slug>)을 쓴다. */
  names?: Record<number, string>
  /** 선택: 판 아래 진화 사다리 + 이모지 타일 보정(셀 비례 크기·대비 원판·모서리 값). classic은 지정하지 않음 → 화면 불변. */
  ladder?: boolean
}

export const themes2048: Record<string, Theme2048> = {
  classic: {
    key: 'classic',
    tiles: Object.fromEntries([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((v) => [v, String(v)])),
  },
  animals: {
    key: 'animals',
    tiles: { 2: '🐭', 4: '🐹', 8: '🐰', 16: '🦊', 32: '🐱', 64: '🐶', 128: '🐺', 256: '🦁', 512: '🐯', 1024: '🐻', 2048: '🐉' },
    names: {
      2: 'Mouse',
      4: 'Hamster',
      8: 'Rabbit',
      16: 'Fox',
      32: 'Cat',
      64: 'Dog',
      128: 'Wolf',
      256: 'Lion',
      512: 'Tiger',
      1024: 'Bear',
      2048: 'Dragon',
    },
    ladder: true,
  },
}
