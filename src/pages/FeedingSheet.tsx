// 급여 기록 시트: 결과(먹음·일부·거부·확인 못함) + 먹이 + 양 + 메모. 기본값만으로 '저장' 한 번이면 끝난다.
import { useState } from 'react'
import { useUI } from '../app/ui'
import { useRefresh, type Animal, type Keeper } from '../data/keeper'
import { addD, today, yd } from '../lib/date'
import { FEED_RESULT_LABEL, FEED_RESULTS, REFUSE_ALERT, type Feeding, type FeedResult } from '../lib/feeding'
import { nm } from '../lib/format'
import { spInfo } from '../lib/species'
import { errMsg, supabase } from '../lib/supabase'
import { Chips, Seg, Sheet } from '../ui/kit'

export const RESULT_COLOR: Record<FeedResult, string> = {
  ate: 'var(--blue)',
  partial: '#5B8BD0',
  refused: 'var(--warn)',
  unknown: 'var(--muted-2)',
}

export function FeedingSheet({ k, animal, edit, onClose }: { k: Keeper; animal: Animal; edit?: Feeding | null; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const sp = spInfo(animal)
  const history = k.fs(animal.id)
  const lastFood = [...history].reverse().find((x) => x.food)?.food ?? ''
  const [date, setDate] = useState(edit?.fed_on ?? today())
  const [result, setResult] = useState<FeedResult>(edit?.result ?? sp.feed.defaultResult)
  const [food, setFood] = useState(edit?.food ?? lastFood)
  const [amount, setAmount] = useState(edit?.amount ?? '')
  const [note, setNote] = useState(edit?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [cfmDel, setCfmDel] = useState(false)
  const foods = Array.from(new Set([...sp.feed.foods, ...(lastFood ? [lastFood] : [])]))

  const save = async () => {
    if (busy || !date) return
    setBusy(true)
    const rec = { fed_on: date, result, food: food.trim().slice(0, 30), amount: amount.trim().slice(0, 20), note: note.trim().slice(0, 100) }
    const { error } = edit
      ? await supabase.from('feedings').update(rec).eq('id', edit.id)
      : await supabase.from('feedings').insert({ ...rec, animal_id: animal.id })
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '급여 기록을 저장하지 못했어요'), 'warn')
    }
    await refresh('feedings', 'notifications')
    if (!edit && result === 'refused') {
      const streak = k.feedSum(animal.id).refuseStreak + 1
      if (streak >= REFUSE_ALERT - 1) {
        ui.toast(`${nm(animal)} 연속 ${streak}회 거부 · 체중과 건강 상태를 함께 확인해 보세요`, 'warn')
        return onClose()
      }
    }
    ui.toast(`${edit ? '급여 기록을 수정했어요' : '급여 기록'} · ${FEED_RESULT_LABEL[result]}${rec.food ? ' · ' + rec.food : ''}`)
    onClose()
  }

  const del = async () => {
    if (!edit) return
    if (!cfmDel) return setCfmDel(true)
    setBusy(true)
    const { error } = await supabase.from('feedings').delete().eq('id', edit.id)
    if (error) {
      setBusy(false)
      return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    }
    await refresh('feedings')
    ui.toast(`${yd(edit.fed_on)} 급여 기록을 삭제했어요`)
    onClose()
  }

  return (
    <Sheet title={`${edit ? '급여 수정' : '급여 기록'} · ${nm(animal)}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="label">결과</div>
          <Seg testId="feed-result" height={46} items={FEED_RESULTS.map((r) => [r, FEED_RESULT_LABEL[r]] as const)} value={result} onChange={setResult} />
          {sp.feed.defaultResult === 'unknown' && (
            <div className="hint" style={{ marginTop: 6 }}>
              사료형 먹이는 먹었는지 바로 알기 어려워 ‘확인 못함’이 기본이에요
            </div>
          )}
        </div>
        <div>
          <div className="label">먹이</div>
          <Chips wrap small items={foods.map((x) => [x, x] as const)} value={food} onChange={(x) => setFood(food === x ? '' : x)} />
          <input className="input" style={{ marginTop: 8 }} value={food} maxLength={30} onChange={(e) => setFood(e.target.value)} placeholder="직접 입력 · 선택" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="label">날짜</div>
            <input
              type="date"
              className="input mono"
              style={{ padding: '0 10px', fontSize: 14 }}
              value={date}
              min={addD(today(), -365)}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <div className="label">양 · 선택</div>
            <input className="input" value={amount} maxLength={20} onChange={(e) => setAmount(e.target.value)} placeholder="예: 3마리, 1스푼" />
          </div>
        </div>
        <div>
          <div className="label">메모 · 선택</div>
          <input className="input" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="예: 탈피 직후" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {edit && (
            <button
              type="button"
              className={`btn btn-danger${cfmDel ? ' on' : ''}`}
              style={{ flex: 'none', minWidth: 80, padding: '0 14px', fontSize: 14 }}
              onClick={del}
              disabled={busy}
            >
              {cfmDel ? '한 번 더 누르면 삭제' : '삭제'}
            </button>
          )}
          <button type="button" data-test="feed-save" className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
            {busy ? '저장 중…' : edit ? '수정 저장' : '저장'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// 최근 30일 급여 띠: 하루 한 칸, 그날의 마지막 결과 색
export function FeedStrip({ list, days = 30 }: { list: Feeding[]; days?: number }) {
  const T = today()
  const byDay = new Map<string, FeedResult>()
  for (const x of list) byDay.set(x.fed_on, x.result)
  const cells = Array.from({ length: days }, (_, i) => addD(T, i - days + 1))
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${days}, 1fr)`, gap: 2 }} aria-label="최근 30일 급여 기록">
        {cells.map((d) => {
          const r = byDay.get(d)
          return (
            <span
              key={d}
              title={r ? `${yd(d)} ${FEED_RESULT_LABEL[r]}` : yd(d)}
              style={{ height: 14, borderRadius: 3, background: r ? RESULT_COLOR[r] : 'var(--seg)' }}
            />
          )
        })}
      </div>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-2)', marginTop: 4 }}>
        <span>{yd(cells[0])}</span>
        <span>
          <span style={{ color: RESULT_COLOR.ate }}>■</span> 먹음 <span style={{ color: RESULT_COLOR.refused }}>■</span> 거부{' '}
          <span style={{ color: RESULT_COLOR.unknown }}>■</span> 확인 못함
        </span>
        <span>오늘</span>
      </div>
    </div>
  )
}
