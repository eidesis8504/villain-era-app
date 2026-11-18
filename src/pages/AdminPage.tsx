// 운영자 전용 '검증 현황': 반응 숫자, 의견·설문·오류, 신고 처리
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import {
  moderate,
  useAdminErrors,
  useAdminFeedback,
  useAdminMetrics,
  useAdminReports,
  useAdminSurveys,
  type AdminMetrics,
  type ModerateAction,
} from '../data/admin'
import { REPORT_REASONS } from '../data/safety'
import { gap, isoDay, md, yd } from '../lib/date'
import { judge, type Verdict } from '../lib/metrics'
import { errMsg, supabase } from '../lib/supabase'
import { ErrorBox, Seg, Spinner } from '../ui/kit'
import { NotFound } from './InfoPages'

const TABS = [
  ['stats', '현황'],
  ['feedback', '의견'],
  ['survey', '설문'],
  ['errors', '오류'],
  ['reports', '신고'],
] as const
type Tab = (typeof TABS)[number][0]

const pctTxt = (v: number | null) => (v === null ? '—' : `${v}%`)
const VERDICT: Record<Verdict, { color: string; label: string }> = {
  pass: { color: 'var(--blue)', label: '✓ 기준 이상' },
  fail: { color: 'var(--warn)', label: '기준 미달' },
  small: { color: 'var(--muted-2)', label: '표본 부족' },
}

function Criterion({ title, rate, target, sample, note }: { title: string; rate: number | null; target: number; sample: number; note: string }) {
  const v = VERDICT[judge(rate, target, sample)]
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{title}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: v.color }}>
        {pctTxt(rate)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: v.color }}>
        {v.label} · 기준 {target}%
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{note}</div>
    </div>
  )
}

function DailyBars({ daily }: { daily: AdminMetrics['daily'] }) {
  const mx = Math.max(1, ...daily.map((d) => Math.max(d.new_users, d.active_users)))
  const W = 14 * 22
  const H = 90
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} style={{ width: '100%', height: 120 }} role="img" aria-label="최근 14일 신규·활성 사용자">
        {daily.map((d, i) => {
          const x = i * 22 + 3
          const ha = (d.active_users / mx) * H
          const hn = (d.new_users / mx) * H
          return (
            <g key={d.day}>
              <rect x={x} y={H - ha} width={8} height={ha} rx={2} fill="#0148AB" />
              <rect x={x + 9} y={H - hn} width={8} height={hn} rx={2} fill="#B4540A" />
              {i % 2 === 0 && (
                <text x={x + 8} y={H + 13} fontSize={8} textAnchor="middle" fill="#8A8E95" fontFamily="IBM Plex Mono">
                  {md(d.day)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
        <span style={{ color: '#0148AB' }}>■</span> 활성 <span style={{ color: '#B4540A' }}>■</span> 신규 · 최대 {mx}명
      </div>
    </div>
  )
}

function StatsTab({ m }: { m: AdminMetrics }) {
  const ui = useUI()
  const qc = useQueryClient()
  const [launch, setLaunch] = useState(m.launch_on)
  const t = m.targets
  const startRate = m.funnel.landing ? Math.round((1000 * m.funnel.started) / m.funnel.landing) / 10 : null

  const saveLaunch = async () => {
    const { error } = await supabase.rpc('admin_set_config', { p_key: 'launch_on', p_value: launch })
    if (error) return ui.toast(errMsg(error, '저장하지 못했어요'), 'warn')
    await qc.invalidateQueries({ queryKey: ['admin_metrics'] })
    ui.toast(`검증 시작일을 ${launch}로 바꿨어요`)
  }

  const box = (label: string, value: string | number, sub?: string) => (
    <div className="card" style={{ padding: 12, textAlign: 'center', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{sub}</div>}
    </div>
  )

  return (
    <div className="page" style={{ gap: 14 }}>
      <div className="card card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          검증 시작일 {m.launch_on} (D+{gap(m.launch_on, m.today)})
        </span>
        <input type="date" className="input mono" style={{ width: 160, height: 38 }} value={launch} onChange={(e) => setLaunch(e.target.value)} />
        <button type="button" className="btn btn-outline btn-xs" style={{ padding: '0 12px' }} onClick={saveLaunch} disabled={launch === m.launch_on}>
          바꾸기
        </button>
        <span className="hint" style={{ width: '100%' }}>
          시작일 이후에 처음 연 사용자만 집계해요 · 운영자·시험 계정은 빠져요 · 1분마다 새로 고침
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {box('방문', m.funnel.landing, '환영 화면')}
        <span style={{ color: 'var(--muted-2)' }}>→</span>
        {box('시작', m.funnel.started, startRate === null ? '' : `방문의 ${startRate}%`)}
        <span style={{ color: 'var(--muted-2)' }}>→</span>
        {box('첫 개체', m.funnel.activated, pctTxt(m.funnel.activation_rate))}
      </div>

      <div className="section-title">검증 기준</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
        <Criterion title="첫 사용 (첫 개체 등록)" rate={m.funnel.activation_rate} target={t.activation} sample={m.funnel.started} note={`시작 ${m.funnel.started}명 중`} />
        <Criterion title="7일 안 재방문" rate={m.retention.d7.rate} target={t.d7} sample={m.retention.d7.eligible} note={`대상 ${m.retention.d7.eligible}명 중 ${m.retention.d7.returned}명`} />
        <Criterion title="급여 기록 30일 사용" rate={m.research.feeding.rate30} target={t.feeding30} sample={m.active.d30} note={`30일 활성 ${m.active.d30}명 기준`} />
        <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>의견 · 추천 의향</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>
            {m.survey.nps === null ? '—' : `NPS ${m.survey.nps}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>
            설문 {m.survey.responses}건 · 의견 {m.feedback.total}건 (새 의견 {m.feedback.new})
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="section-title">활성 사용자</span>
          <span className="mono" style={{ fontSize: 13 }}>
            오늘 {m.active.d1} · 7일 {m.active.d7} · 30일 {m.active.d30}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--sub)' }}>
          재방문 D1 {pctTxt(m.retention.d1.rate)} · D7 {pctTxt(m.retention.d7.rate)} · D30 {pctTxt(m.retention.d30.rate)}
        </div>
        <DailyBars daily={m.daily} />
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="section-title">기능별 30일 사용률</span>
        {m.features.map((f) => (
          <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <span>{f.label}</span>
            <span style={{ height: 8, background: 'var(--seg)', borderRadius: 4, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.min(100, f.rate ?? 0)}%`, background: 'var(--blue)' }} />
            </span>
            <span className="mono" style={{ textAlign: 'right' }}>
              {pctTxt(f.rate)} <span style={{ color: 'var(--muted-2)' }}>{f.users}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-title">유입 경로별</span>
        {m.sources.length === 0 && <div className="hint">아직 없어요</div>}
        {m.sources.map((s) => (
          <div key={s.source} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 70px', fontSize: 13, gap: 6 }}>
            <span className="ellipsis">{s.source}</span>
            <span className="mono">{s.users}명</span>
            <span className="mono">첫 개체 {s.activated}</span>
            <span className="mono">D7 {pctTxt(s.d7_rate)}</span>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="section-title">기기별</span>
        {m.platforms.map((p) => (
          <div key={p.platform} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{{ ios: '아이폰·아이패드', android: '안드로이드', desktop: 'PC', other: '기타' }[p.platform] ?? p.platform}</span>
            <span className="mono">
              {p.users}명 · 홈 화면 앱 {p.standalone_users}
            </span>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <span className="section-title">리서치 기능 지표</span>
        <div>
          급여: 30일 사용 {pctTxt(m.research.feeding.rate30)} ({m.research.feeding.users30}명) · 30일 안 재기록 {pctTxt(m.research.feeding.reuse_rate)}{' '}
          <span className="hint">(목표 35% · 60%)</span>
        </div>
        <div>
          번식: 산란 암컷 등록 {m.research.breeding.breeder_users}명 중 메이팅·알 기록 {m.research.breeding.recorded_users}명 ({pctTxt(m.research.breeding.rate)}){' '}
          <span className="hint">(목표 30%)</span>
        </div>
        <div>
          건강: 30일 기록 {pctTxt(m.research.health.rate30)} ({m.research.health.users30}명) <span className="hint">(목표 6%)</span>
        </div>
        <div>
          상담 카드 Q&A {m.research.consult.qa_with_card}건 중 채택 {m.research.consult.adopted_with_card} · 카드 없는 Q&A {m.research.consult.qa_without_card}건 중 채택{' '}
          {m.research.consult.adopted_without_card}
        </div>
      </div>

      <div className="hint">
        오류 최근 7일 {m.errors.last7}건 · 처리할 신고 {m.reports.open}건
      </div>
    </div>
  )
}

function FeedbackTab() {
  const q = useAdminFeedback()
  const qc = useQueryClient()
  const ui = useUI()
  if (q.isLoading) return <Spinner center />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  const setStatus = async (id: number, status: 'read' | 'done') => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
    if (error) return ui.toast(errMsg(error, '저장하지 못했어요'), 'warn')
    qc.invalidateQueries({ queryKey: ['admin_feedback'] })
    qc.invalidateQueries({ queryKey: ['admin_metrics'] })
  }
  return (
    <div className="page">
      {(q.data ?? []).map((f) => (
        <div key={f.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, opacity: f.status === 'done' ? 0.6 : 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span className="tag">{f.kind}</span>
            {f.status === 'new' && <span className="tag warn">새 의견</span>}
            <span className="mono" style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>
              {yd(isoDay(f.created_at))} · {f.path} · {f.app_version}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.body}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {f.status === 'new' && (
              <button type="button" className="btn btn-plain btn-xs" style={{ padding: '0 12px' }} onClick={() => setStatus(f.id, 'read')}>
                읽음
              </button>
            )}
            {f.status !== 'done' && (
              <button type="button" className="btn btn-outline btn-xs" style={{ padding: '0 12px' }} onClick={() => setStatus(f.id, 'done')}>
                반영 완료
              </button>
            )}
          </div>
        </div>
      ))}
      {!q.data?.length && <div className="empty">아직 의견이 없어요</div>}
    </div>
  )
}

function SurveyTab({ m }: { m?: AdminMetrics }) {
  const q = useAdminSurveys()
  if (q.isLoading) return <Spinner center />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  return (
    <div className="page">
      {m && (
        <div className="card card-pad mono" style={{ fontSize: 13 }}>
          응답 {m.survey.responses} · 추천(9–10) {m.survey.promoters} · 중립(7–8) {m.survey.passives} · 비추천(0–6) {m.survey.detractors} · NPS{' '}
          {m.survey.nps ?? '—'}
        </div>
      )}
      {(q.data ?? []).map((s) => (
        <div key={s.user_id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <b className="mono" style={{ color: s.nps >= 9 ? 'var(--blue)' : s.nps <= 6 ? 'var(--warn)' : 'var(--ink)' }}>{s.nps}점</b>
            {s.best_feature && <span className="tag">{s.best_feature}</span>}
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-2)' }}>
              {yd(isoDay(s.created_at))}
            </span>
          </div>
          {s.wish && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.wish}</div>}
        </div>
      ))}
      {!q.data?.length && <div className="empty">아직 설문 응답이 없어요</div>}
    </div>
  )
}

function ErrorsTab() {
  const q = useAdminErrors()
  if (q.isLoading) return <Spinner center />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  return (
    <div className="page">
      {(q.data ?? []).map((e) => (
        <details key={e.id} className="card" style={{ padding: 12 }}>
          <summary style={{ fontSize: 13, cursor: 'pointer' }}>
            <b>{e.message || '(메시지 없음)'}</b>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              {' '}
              · {yd(isoDay(e.created_at))} · {e.path} · {e.app_version}
            </span>
          </summary>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--sub)' }}>{e.stack}</pre>
          <div style={{ fontSize: 11, color: 'var(--muted-2)' }}>{e.ua}</div>
        </details>
      ))}
      {!q.data?.length && <div className="empty">기록된 오류가 없어요</div>}
    </div>
  )
}

const REASON = new Map(REPORT_REASONS)
const KIND_TXT = { post: '글', comment: '댓글', user: '회원' } as const

function ReportsTab() {
  const q = useAdminReports()
  const qc = useQueryClient()
  const ui = useUI()
  const [busy, setBusy] = useState<number | null>(null)
  if (q.isLoading) return <Spinner center />
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  const act = async (id: number, a: ModerateAction) => {
    setBusy(id)
    try {
      await moderate(id, a)
      ui.toast({ hide: '숨겼어요', unhide: '숨김을 풀었어요', delete: '삭제했어요', dismiss: '신고를 기각했어요', block_user: '회원 이용을 제한했어요' }[a])
      await Promise.all(['admin_reports', 'admin_metrics', 'posts', 'post', 'comments'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
    } catch (e) {
      ui.toast(errMsg(e, '처리하지 못했어요'), 'warn')
    }
    setBusy(null)
  }
  const btn = (id: number, a: ModerateAction, label: string, warn = false) => (
    <button
      type="button"
      className={`btn ${warn ? 'btn-danger' : 'btn-plain'} btn-xs`}
      style={{ padding: '0 10px', fontSize: 12 }}
      disabled={busy === id}
      onClick={() => act(id, a)}
    >
      {label}
    </button>
  )
  return (
    <div className="page">
      <div className="hint">운영정책: 신고는 24시간 안에 확인해요 · 서로 다른 3명이 신고한 글·댓글은 이미 숨겨져 있어요</div>
      {(q.data ?? []).map((r) => (
        <div key={r.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span className="tag">{KIND_TXT[r.target_kind]}</span>
            <span className="tag warn">{REASON.get(r.reason as never) ?? r.reason}</span>
            <span style={{ color: 'var(--muted)' }}>작성자 {r.who}</span>
            <span className="mono" style={{ marginLeft: 'auto', color: 'var(--muted-2)' }}>
              {yd(isoDay(r.created_at))}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{r.preview}</div>
          {r.note && <div style={{ fontSize: 13, color: 'var(--sub)' }}>신고 내용: {r.note}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {r.target_kind !== 'user' && btn(r.id, 'hide', '숨김')}
            {r.target_kind !== 'user' && btn(r.id, 'unhide', '숨김 해제')}
            {r.target_kind !== 'user' && btn(r.id, 'delete', '삭제', true)}
            {btn(r.id, 'dismiss', '기각')}
            {btn(r.id, 'block_user', '회원 이용 제한', true)}
          </div>
        </div>
      ))}
      {!q.data?.length && <div className="empty">처리할 신고가 없어요</div>}
    </div>
  )
}

export default function AdminPage() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'stats') as Tab
  const m = useAdminMetrics()
  if (!isAdmin) return <NotFound />
  return (
    <Screen title="검증 현황" back="/more" wide>
      <div style={{ padding: '4px 18px 0' }}>
        <Seg
          height={36}
          items={TABS.map(([k, l]) => [k, k === 'reports' && m.data?.reports.open ? `${l} ${m.data.reports.open}` : l] as const)}
          value={tab}
          onChange={(k) => setParams({ tab: k }, { replace: true })}
        />
      </div>
      {tab === 'stats' && (m.isLoading ? <Spinner center /> : m.error ? <ErrorBox error={m.error} onRetry={() => m.refetch()} /> : m.data && <StatsTab m={m.data} />)}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'survey' && <SurveyTab m={m.data} />}
      {tab === 'errors' && <ErrorsTab />}
      {tab === 'reports' && <ReportsTab />}
    </Screen>
  )
}
