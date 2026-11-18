// 2주 차 설문: 계정을 만든 지 14일이 지나면 홈에 한 번 보여 준다. '나중에'는 3일 뒤 다시.
export const SURVEY_AFTER_DAYS = 14
export const SURVEY_SNOOZE_DAYS = 3
export const SURVEY_SNOOZE_KEY = 've-survey-snooze'

export function surveyDue(createdAtIso: string, now: Date, answered: boolean, snoozeUntil: number | null): boolean {
  if (answered) return false
  if (snoozeUntil !== null && now.getTime() <= snoozeUntil) return false
  return now.getTime() - Date.parse(createdAtIso) >= SURVEY_AFTER_DAYS * 864e5
}
