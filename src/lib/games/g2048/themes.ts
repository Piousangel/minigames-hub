export interface Theme2048 {
  key: string
  tiles: Record<number, string> // 타일 값 → 표시 문자(숫자 또는 이모지)
}

export const themes2048: Record<string, Theme2048> = {
  classic: {
    key: 'classic',
    tiles: Object.fromEntries([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((v) => [v, String(v)])),
  },
  animals: {
    key: 'animals',
    tiles: { 2: '🐭', 4: '🐹', 8: '🐰', 16: '🦊', 32: '🐱', 64: '🐶', 128: '🐺', 256: '🦁', 512: '🐯', 1024: '🐻', 2048: '🐉' },
  },
}
