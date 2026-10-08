import { useState } from 'react'
import { useMe } from '../app/auth'
import { Screen, useBack } from '../app/Screen'
import { useUI } from '../app/ui'
import { useToggleCheck } from '../data/actions'
import { useChecks, useRefresh, useTodos, type Todo } from '../data/keeper'
import { dateLbl, dow, today } from '../lib/date'
import { errMsg, supabase } from '../lib/supabase'
import { alarmLbl, hhmm, ruleLbl, TODO_TAGS, todosOn } from '../lib/todo'
import { Chips, Seg, Sheet } from '../ui/kit'
import { todoRow } from './shared'

type Form = {
  editId: string
  title: string
  time: string
  mode: 'days' | 'once'
  days: number[]
  date: string
  alarm: number
  tag: string
  tried?: boolean
  busy?: boolean
}

const p2 = (n: number) => String(n).padStart(2, '0')

export function TodoSheet({ todo, onClose }: { todo: Todo | null; onClose: () => void }) {
  const ui = useUI()
  const refresh = useRefresh()
  const T = today()
  const [f, setF] = useState<Form>(() =>
    todo
      ? {
          editId: todo.id,
          title: todo.title,
          time: hhmm(todo.time_of_day),
          mode: todo.mode as Form['mode'],
          days: [...todo.days],
          date: todo.once_date ?? T,
          alarm: todo.alarm_minutes,
          tag: todo.tag,
        }
      : { editId: '', title: '', time: '09:00', mode: 'days', days: [dow(T)], date: T, alarm: 10, tag: '급여' },
  )
  const set = (p: Partial<Form>) => setF((s) => ({ ...s, ...p }))
  const [H, M] = f.time.split(':').map(Number)
  const pm = H >= 12
  const setT = (h: number, m: number) => set({ time: `${p2(h)}:${p2(m)}` })
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
  if (!mins.includes(M)) mins.push(M)
  mins.sort((a, b) => a - b)
  const tErr = !f.title.trim()
  const dErr = f.mode === 'days' && !f.days.length
  const err = tErr ? '할 일 이름을 입력해 주세요' : dErr ? '반복할 요일을 하나 이상 선택해 주세요' : ''

  const save = async () => {
    if (tErr || dErr || !f.time || (f.mode === 'once' && !f.date)) return set({ tried: true })
    set({ busy: true })
    const rec = {
      title: f.title.trim(),
      time_of_day: f.time + ':00',
      mode: f.mode,
      days: f.mode === 'days' ? f.days : [],
      once_date: f.mode === 'once' ? f.date : null,
      alarm_minutes: f.alarm,
      tag: f.tag,
    }
    const { error } = f.editId
      ? await supabase.from('todos').update(rec).eq('id', f.editId)
      : await supabase.from('todos').insert(rec)
    if (error) {
      set({ busy: false })
      return ui.toast(errMsg(error, '할 일을 저장하지 못했어요'), 'warn')
    }
    await refresh('todos')
    ui.toast(`${ruleLbl({ ...rec, id: '' }, T)} ${f.time} · ${alarmLbl(f.alarm)}`)
    onClose()
  }

  const del = async () => {
    set({ busy: true })
    const { error } = await supabase.from('todos').delete().eq('id', f.editId)
    if (error) {
      set({ busy: false })
      return ui.toast(errMsg(error, '삭제하지 못했어요'), 'warn')
    }
    await refresh('todos', 'checks')
    ui.toast('할 일을 삭제했어요')
    onClose()
  }

  const preview = () => {
    if (!f.alarm) return ui.toast('알림 없음으로 설정되어 있어요', 'warn')
    ui.banner({
      title: f.title || '새 할 일',
      body: `${f.alarm === 1440 ? '내일 ' : ''}${f.time} 예정 · ${alarmLbl(f.alarm).replace(' 알림', '')} 알림`,
      kind: 'todo',
    })
  }

  return (
    <Sheet title={f.editId ? '할 일 수정' : '할 일 추가'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          className={`input${f.tried && tErr ? ' bad' : ''}`}
          value={f.title}
          maxLength={60}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="할 일 (예: 배합사료 급여 — 랙 B)"
        />
        <div>
          <div className="label">시간</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 'none', width: 132 }}>
              <Seg
                testId="todo-ampm"
                height={38}
                items={[
                  [0, '오전'],
                  [1, '오후'],
                ]}
                value={pm ? 1 : 0}
                onChange={(v) => {
                  if ((v === 1) !== pm) setT(v === 1 ? (H % 12) + 12 : H % 12, M)
                }}
              />
            </div>
            <select
              className="input"
              data-test="todo-hour"
              style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}
              value={String(H % 12 || 12)}
              onChange={(e) => {
                const n = +e.target.value % 12
                setT(pm ? n + 12 : n, M)
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>
                  {n}시
                </option>
              ))}
            </select>
            <select
              className="input"
              data-test="todo-min"
              style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500 }}
              value={String(M)}
              onChange={(e) => setT(H, +e.target.value)}
            >
              {mins.map((n) => (
                <option key={n} value={n}>
                  {p2(n)}분
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <div className="label">반복</div>
          <Seg
            items={[
              ['days', '요일 반복'],
              ['once', '한 번'],
            ]}
            value={f.mode}
            onChange={(mode) => set({ mode })}
          />
        </div>
        {f.mode === 'days' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = f.days.includes(d)
              return (
                <button
                  type="button"
                  key={d}
                  className={`chip${on ? ' on' : ''}`}
                  style={{ height: 40, borderRadius: 10, padding: 0, fontSize: 14 }}
                  onClick={() => set({ days: on ? f.days.filter((x) => x !== d) : [...f.days, d] })}
                >
                  {'일월화수목금토'[d]}
                </button>
              )
            })}
          </div>
        ) : (
          <input type="date" className="input mono" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        )}
        <div>
          <div className="label">사전 알림</div>
          <Seg
            items={[
              [0, '없음'],
              [10, '10분 전'],
              [30, '30분 전'],
              [1440, '1일 전'],
            ]}
            value={f.alarm}
            onChange={(alarm) => set({ alarm })}
          />
        </div>
        <div>
          <div className="label">분류</div>
          <Chips wrap items={TODO_TAGS.map((t) => [t, t] as const)} value={f.tag} onChange={(tag) => set({ tag })} />
        </div>
        {f.tried && err && <div className="err">{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          {f.editId && (
            <button type="button" className="btn btn-danger" style={{ width: 80, flex: 'none' }} onClick={del} disabled={f.busy}>
              삭제
            </button>
          )}
          <button type="button" className="btn btn-outline" style={{ width: 96, flex: 'none', fontSize: 13 }} onClick={preview}>
            알림 미리보기
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={f.busy}>
            {f.busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export default function TodoPage() {
  const { profile } = useMe()
  const goBack = useBack('/')
  const todos = useTodos().data ?? []
  const checks = useChecks().data ?? []
  const toggle = useToggleCheck()
  const [sheet, setSheet] = useState<{ todo: Todo | null } | null>(null)
  const T = today()
  const items = todosOn(todos, T).map((t) => todoRow(t, T, checks, T))
  const done = items.filter((r) => r.on).length

  return (
    <Screen hideHeader>
      <div>
        <div style={{ background: 'var(--blue)', color: 'var(--cream)', padding: '2px 20px 22px', borderRadius: '0 0 26px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 42 }}>
            <button type="button" aria-label="뒤로" onClick={goBack} style={{ fontSize: 28, lineHeight: 1, paddingRight: 12, color: 'inherit' }}>
              ‹
            </button>
            <span style={{ fontSize: 16, fontWeight: 700 }}>오늘의 할 일</span>
            <button
              type="button"
              data-test="todo-add"
              onClick={() => setSheet({ todo: null })}
              style={{ fontSize: 13, fontWeight: 600, border: '1.4px solid rgba(250,249,246,.7)', borderRadius: 999, padding: '4px 12px', color: 'inherit' }}
            >
              + 추가
            </button>
          </div>
          <div className="mono" style={{ fontWeight: 500, fontSize: 12, marginTop: 12 }}>
            {dateLbl(T)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>오늘 할 일</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: 30 }}>
              {done}
              <span style={{ fontSize: 16 }}> / {items.length}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {items.map((r) => (
              <span key={r.t.id} style={{ flex: 1, height: 6, borderRadius: 3, background: r.seg }} />
            ))}
          </div>
          {!profile.todo_alarm && (
            <div style={{ marginTop: 12, fontSize: 12, background: 'rgba(250,249,246,.16)', borderRadius: 8, padding: '6px 10px' }}>
              할 일 알림이 꺼져 있어요 · 전체 › 설정에서 켤 수 있어요
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px 4px' }}>
          {items.map((r) => (
            <div key={r.t.id} style={{ display: 'grid', gridTemplateColumns: '48px 18px minmax(0,1fr)', gap: 10 }}>
              <span className="mono" style={{ fontWeight: 500, fontSize: 13, color: 'var(--muted)', paddingTop: 18 }}>
                {r.time}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 2, height: 20, background: '#E0DCD2' }} />
                <span style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid var(--blue)', background: r.dot, flex: 'none' }} />
                <span style={{ width: 2, flex: 1, background: '#E0DCD2' }} />
              </div>
              <div
                className="card"
                onClick={() => toggle.mutate({ todoId: r.t.id, day: T, on: !r.on })}
                style={{ borderRadius: 14, padding: '11px 13px', margin: '6px 0', opacity: r.op, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, textDecoration: r.deco }}>{r.t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 3 }}>
                    {r.t.tag} · {r.rule} · {r.alarm}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="수정"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSheet({ todo: r.t })
                  }}
                  style={{ fontSize: 16, color: 'var(--muted-2)', padding: '0 2px 0 8px', lineHeight: 1.2 }}
                >
                  ⋯
                </button>
              </div>
            </div>
          ))}
          {!items.length && <div className="empty">오늘 예정된 할 일이 없어요</div>}
        </div>

        <div style={{ padding: '12px 20px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span className="section-title">등록된 반복 작업</span>
            <span className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>
              {todos.length}개
            </span>
          </div>
          <div className="list-card">
            {todos.map((t) => (
              <div key={t.id} className="list-row" onClick={() => setSheet({ todo: t })} style={{ gap: 12 }}>
                <span className="mono" style={{ fontWeight: 500, fontSize: 13, color: 'var(--blue)', width: 44, flex: 'none' }}>
                  {hhmm(t.time_of_day)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 14, fontWeight: 600 }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>
                    {ruleLbl(t, T)} · {alarmLbl(t.alarm_minutes)}
                  </div>
                </div>
                <span style={{ color: 'var(--muted-2)' }}>›</span>
              </div>
            ))}
            {!todos.length && (
              <div style={{ padding: '18px 0', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
                + 추가로 급여·분무·청소 같은 반복 작업을 등록하세요
              </div>
            )}
          </div>
        </div>
      </div>
      {sheet && <TodoSheet todo={sheet.todo} onClose={() => setSheet(null)} />}
    </Screen>
  )
}
