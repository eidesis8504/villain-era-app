// 종별 설정 (프로토타입 SP 표). 새 종은 여기에만 추가하면 된다.
// 급여·번식 기본값은 '감수 전 기본값'이다 — 화면에 그렇게 표시하고, 개체마다 고칠 수 있게 한다.
import type { FeedResult } from './feeding'

export type SpeciesInfo = {
  en: string
  wMax: number
  eggsMax: number
  eggsDef: number
  morphLbl: string
  morphPh: string
  morphDef: string
  morphs: string[]
  feed: { everyDays: number; foods: string[]; defaultResult: FeedResult }
  // 인큐 온도 구간(오름차순, 해당 온도 이하인 첫 구간) · 그라비드 확인 후 산란까지 · 메이팅 후 첫 산란 · 재산란 간격
  breed: { incubation: { maxTemp: number; days: [number, number] }[]; gravidToLay: number; firstLayAfterMating: [number, number]; relay: [number, number] }
}

export const SPECIES: Record<string, SpeciesInfo> = {
  크레스티드게코: {
    en: 'CRESTED GECKO',
    wMax: 150,
    eggsMax: 4,
    eggsDef: 2,
    morphLbl: '모프',
    morphPh: '예: 릴리화이트 할리퀸',
    morphDef: '노멀',
    morphs: ['노멀', '할리퀸', '익스트림 할리퀸', '핀스트라이프', '달마시안', '릴리화이트', '카푸치노', 'het 액산틱'],
    feed: { everyDays: 2, foods: ['슈퍼푸드(CGD)', '귀뚜라미', '듀비아', '밀웜'], defaultResult: 'unknown' },
    breed: {
      incubation: [
        { maxTemp: 21.9, days: [90, 120] },
        { maxTemp: 24.9, days: [65, 90] },
        { maxTemp: 27.9, days: [55, 70] },
        { maxTemp: 40, days: [50, 65] },
      ],
      gravidToLay: 14,
      firstLayAfterMating: [30, 45],
      relay: [28, 40],
    },
  },
  리키에너스: {
    en: 'LEACHIANUS GECKO',
    wMax: 800,
    eggsMax: 4,
    eggsDef: 2,
    morphLbl: '로컬리티',
    morphPh: '예: 파인섬',
    morphDef: '미정',
    morphs: ['GT(그랑테르)', '파인섬', '누아나', '헨켈리', '모로'],
    feed: { everyDays: 3, foods: ['슈퍼푸드(CGD)', '귀뚜라미', '듀비아', '과일'], defaultResult: 'unknown' },
    breed: {
      incubation: [
        { maxTemp: 23.9, days: [90, 130] },
        { maxTemp: 26.9, days: [65, 90] },
        { maxTemp: 40, days: [55, 75] },
      ],
      gravidToLay: 21,
      firstLayAfterMating: [35, 60],
      relay: [30, 45],
    },
  },
  테구: {
    en: 'TEGU',
    wMax: 10000,
    eggsMax: 60,
    eggsDef: 25,
    morphLbl: '타입',
    morphPh: '예: 아르헨티나 블랙앤화이트',
    morphDef: '미정',
    morphs: ['아르헨티나 블랙앤화이트', '레드', '블루', '알비노', '콜롬비안'],
    feed: { everyDays: 2, foods: ['육류', '계란', '곤충', '과일·채소'], defaultResult: 'ate' },
    breed: {
      incubation: [
        { maxTemp: 27.9, days: [70, 90] },
        { maxTemp: 40, days: [55, 70] },
      ],
      gravidToLay: 14,
      firstLayAfterMating: [30, 50],
      relay: [365, 365],
    },
  },
}

export const SPECIES_NAMES = Object.keys(SPECIES)
export const DEFAULT_SPECIES = '크레스티드게코'

export const spOf = (a?: { species: string } | null) =>
  a && SPECIES[a.species] ? a.species : DEFAULT_SPECIES
export const spInfo = (a?: { species: string } | null) => SPECIES[spOf(a)]
