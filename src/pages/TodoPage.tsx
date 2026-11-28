import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Check, ChevronRight, Ellipsis, Plus } from 'lucide-react'
import { useMe } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useToggleCheck } from '../data/actions'
import { useChecks, useRefresh, useTodos, type Todo } from '../data/keeper'
import { dow, today } from '../lib/date'
import { dayLabel, homeHeadline } from '../lib/home'
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
  const todos = useTodos().data ?? []
  const checks = useChecks().data ?? []
  const toggle = useToggleCheck()
  const loc = useLocation()
  const nav = useNavigate()
  const wantAdd = !!(loc.state as { add?: boolean } | null)?.add
  const [sheet, setSheet] = useState<{ todo: Todo | null } | null>(wantAdd ? { todo: null } : null)
  // 기록 시트의 '할 일 추가'로 들어오면 추가 창을 연 채로 시작한다. 뒤로 돌아왔을 때 다시 열리지 않게 표시는 지운다
  useEffect(() => {
    if (wantAdd) nav('.', { replace: true, state: null })
  }, [wantAdd, nav])
  const T = today()
  const items = todosOn(todos, T).map((t) => todoRow(t, T, checks, T))
  const done = items.filter((r) => r.on).length

  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  return (
    <Screen title="오늘의 할 일" back="/" right={{ label: '추가', icon: <Plus size={18} />, onClick: () => setSheet({ todo: null }), test: 'todo-add' }}>
      <div className="page" style={{ gap: 0 }}>
        <div className="meta" style={{ marginTop: 8 }}>
          {dayLabel(T)}
        </div>
        <h1 className="h-display" style={{ marginTop: 4 }}>
          {homeHeadline(items.length, done)}
        </h1>
        {!profile.todo_alarm && (
          <button type="button" className="notice" style={{ marginTop: 12 }} onClick={() => nav('/more')}>
            <span className="grow">할 일 알림이 꺼져 있어요 · 전체 › 설정에서 켤 수 있어요</span>
            <ChevronRight size={16} className="chev" />
          </button>
        )}
        {items.length > 0 && (
          <>
            <div className="prog" style={{ margin: '16px 0 4px' }}>
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="rows">
              {items.map((r) => (
                <div
                  key={r.t.id}
                  role="checkbox"
                  aria-checked={r.on}
                  tabIndex={0}
                  className={`row${r.on ? ' done' : ''}`}
                  onClick={() => toggle.mutate({ todoId: r.t.id, day: T, on: !r.on })}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      toggle.mutate({ todoId: r.t.id, day: T, on: !r.on })
                    }
                  }}
                >
                  <span className={`check${r.on ? ' on' : ''}`}>{r.on && <Check size={16} />}</span>
                  <span className="grow">
                    <span className="row-t">{r.t.title}</span>
                    <span className="meta">
                      {r.time} · {r.t.tag} · {r.rule} · {r.alarm}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="수정"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSheet({ todo: r.t })
                    }}
                  >
                    <Ellipsis size={20} className="chev" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sec-h" style={{ marginTop: 28 }}>
          <h2 className="h-title">등록된 반복 작업</h2>
          <span className="micro">{todos.length}개</span>
        </div>
        <div className="rows">
          {todos.map((t) => (
            <button type="button" key={t.id} className="row" onClick={() => setSheet({ todo: t })}>
              <span className="meta" style={{ width: 44, flex: 'none' }}>
                {hhmm(t.time_of_day)}
              </span>
              <span className="grow">
                <span className="row-t ellipsis">{t.title}</span>
                <span className="meta">
                  {ruleLbl(t, T)} · {alarmLbl(t.alarm_minutes)}
                </span>
              </span>
              <ChevronRight size={18} className="chev" />
            </button>
          ))}
        </div>
        {!todos.length && <div className="empty">오른쪽 위 추가로 급여·분무·청소 같은 반복 작업을 등록하세요</div>}
      </div>
      {sheet && <TodoSheet todo={sheet.todo} onClose={() => setSheet(null)} />}
    </Screen>
  )
}
