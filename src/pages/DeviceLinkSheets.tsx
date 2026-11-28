// 다른 기기에서 이어 쓰기: 코드 받기(쓰던 기기) · 코드 입력(새 기기) · 다른 기기 기록 불러오기 · 다른 기기 모두 연결 끊기
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../app/auth'
import { useUI } from '../app/ui'
import {
  createLinkCode,
  formatCode,
  formatRemaining,
  isCompleteCode,
  LinkError,
  linkErrorMessage,
  normalizeCode,
  revokeLinkCodes,
} from '../lib/deviceLink'
import { supabase } from '../lib/supabase'
import { Sheet, Spinner } from '../ui/kit'

const NOT_EMPTY =
  '이 기기에 기록이 있어 불러올 수 없어요. 이 기기 기록이 필요 없다면 전체 › 계정과 기록 삭제 후 처음 화면에서 불러와 주세요.'

const messageOf = (e: unknown) => (e instanceof LinkError ? e.message : linkErrorMessage('server'))

const noteStyle = { fontSize: 13, lineHeight: 1.7, color: 'var(--sub)', margin: 0, paddingLeft: 18 } as const

// 코드 입력 (처음 화면·전체 공용). 제출 중·성공 뒤에는 잠가 두 번 보내지 않는다.
function CodeForm({ onSubmit }: { onSubmit: (code: string) => Promise<void> }) {
  const ui = useUI()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const ready = isCompleteCode(value)

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setErr('')
    try {
      await onSubmit(normalizeCode(value))
      ui.toast('기록을 불러왔어요')
    } catch (e) {
      // 전환 중 화면이 바뀌어 이 폼이 사라졌다면 알림으로라도 알려 준다
      if (alive.current) {
        setErr(messageOf(e))
        setBusy(false)
      } else ui.toast(messageOf(e), 'warn')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        data-test="code-input"
        className="input mono"
        style={{ fontSize: 22, letterSpacing: '.12em', textAlign: 'center' }}
        value={formatCode(normalizeCode(value))}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="XXXX-XXXX"
        aria-label="연결 코드"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        disabled={busy}
      />
      <button type="button" data-test="code-submit" className="btn btn-primary" onClick={submit} disabled={!ready || busy}>
        {busy ? '불러오는 중…' : '불러오기'}
      </button>
      {err && (
        <div className="err" data-test="code-error" style={{ textAlign: 'center' }}>
          {err}
        </div>
      )}
    </div>
  )
}

// 처음 화면용: 이미 쓰던 기록 불러오기
export function EnterCodeSheet({
  title,
  onClose,
  onSubmit,
}: {
  title: string
  onClose: () => void
  onSubmit: (code: string) => Promise<void>
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hint" style={{ fontSize: 13 }}>
          쓰던 기기에서 전체 › 다른 기기에서 이어 쓰기를 열면 코드가 보여요
        </div>
        <CodeForm onSubmit={onSubmit} />
      </div>
    </Sheet>
  )
}

// 코드 받기: 남은 시간은 서버가 준 유효 시간(초)과 받은 순간의 기기 시계로 센다(기기 시계가 틀려도 10분)
function CodeView() {
  const ui = useUI()
  const [issued, setIssued] = useState<{ code: string; deadline: number } | null>(null)
  const [busy, setBusy] = useState(true) // 열자마자 코드를 만든다
  const [err, setErr] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const fetchCode = useCallback(async () => {
    try {
      const { code, expiresIn } = await createLinkCode()
      const at = Date.now()
      setIssued({ code, deadline: at + expiresIn * 1000 })
      setNow(at)
    } catch (e) {
      setErr(messageOf(e))
    } finally {
      setBusy(false)
    }
  }, [])
  const issue = () => {
    setBusy(true)
    setErr('')
    fetchCode()
  }

  // 개발 모드에서 effect가 두 번 돌아도 코드는 한 번만 만든다(발급 횟수 제한 보호)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    fetchCode()
  }, [fetchCode])

  useEffect(() => {
    if (!issued) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [issued])

  const left = issued ? issued.deadline - now : 0
  const expired = !!issued && left <= 0

  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(formatCode(issued.code))
      ui.toast('코드를 복사했어요')
    } catch {
      ui.toast('코드를 길게 눌러 복사해 주세요', 'warn')
    }
  }

  return (
    <>
      <div className="hint" style={{ fontSize: 13 }}>
        새 기기에서 ‘이미 쓰던 기록이 있어요’를 누르고 이 코드를 입력하세요
      </div>
      {/* 만드는 중·만료·표시 모두 같은 높이로 그려 아래 메뉴가 밀리지 않게 한다(누르려던 줄이 바뀌지 않도록) */}
      <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div
          data-test={issued && !expired ? 'link-code' : undefined}
          className="mono"
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '.14em',
            color: issued && !expired ? undefined : 'var(--muted-2)',
            textDecoration: expired ? 'line-through' : undefined,
          }}
        >
          {issued ? formatCode(issued.code) : '····-····'}
        </div>
        <div data-test="link-remaining" className="hint">
          {!issued ? (busy ? '코드를 만드는 중…' : '코드를 만들지 못했어요') : expired ? '코드가 만료됐어요' : `${formatRemaining(left)} 남음`}
        </div>
        <button
          type="button"
          data-test="link-copy"
          className="btn btn-outline"
          onClick={copy}
          disabled={!issued || expired}
          style={{ width: '100%' }}
        >
          복사
        </button>
        {err && <div className="err">{err}</div>}
      </div>
      <ul style={noteStyle}>
        <li>한 번만 쓸 수 있고 10분 뒤 사라져요</li>
        <li>이 코드를 아는 사람은 내 기록을 볼 수 있어요. 다른 사람에게 보여 주지 마세요</li>
      </ul>
      <button type="button" data-test="link-renew" className="btn btn-plain" onClick={issue} disabled={busy}>
        {busy ? '만드는 중…' : '새 코드 받기'}
      </button>
    </>
  )
}

// 이 기기로 다른 기기의 기록 불러오기: 빈 계정일 때만 (빈 계정은 지우고 전환)
function LoadView() {
  const { switchAccount, uid } = useAuth()
  const empty = useQuery({
    queryKey: ['account-empty', uid],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_account_is_empty')
      if (error) throw error
      return data
    },
    staleTime: 0,
    gcTime: 0,
  })

  if (empty.isPending || (empty.isError && empty.isFetching)) return <Spinner center />
  if (empty.isError)
    return (
      <>
        <div className="err">{linkErrorMessage('network')}</div>
        <button type="button" className="btn btn-outline" onClick={() => empty.refetch()}>
          다시 시도
        </button>
      </>
    )
  if (!empty.data)
    return (
      <div data-test="link-not-empty" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
        {NOT_EMPTY}
      </div>
    )
  return (
    <>
      <div className="hint" style={{ fontSize: 13 }}>
        쓰던 기기에서 받은 코드를 넣으면, 이 기기는 그 계정으로 바뀌어요. 이 기기의 빈 계정은 지워져요.
      </div>
      <CodeForm onSubmit={switchAccount} />
    </>
  )
}

function RevokeView({ onDone }: { onDone: () => void }) {
  const ui = useUI()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      await revokeLinkCodes()
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      ui.toast('다른 기기 연결을 끊었어요')
      onDone()
    } catch (e) {
      ui.toast(e instanceof LinkError ? e.message : linkErrorMessage('network'), 'warn')
      setBusy(false)
    }
  }
  return (
    <>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--sub)' }}>
        이 기기를 뺀 다른 기기에서 모두 로그아웃돼요. 다른 기기는 최대 1시간 안에 처음 화면으로 돌아가요.
      </div>
      <button
        type="button"
        data-test="link-revoke-confirm"
        className="btn"
        style={{ background: 'var(--warn)', color: '#fff' }}
        onClick={run}
        disabled={busy}
      >
        {busy ? '끊는 중…' : '연결 끊기'}
      </button>
    </>
  )
}

const TITLES = {
  code: '다른 기기에서 이어 쓰기',
  load: '다른 기기의 기록 불러오기',
  revoke: '다른 기기 모두 연결 끊기',
} as const

// 회원 화면용 (전체 › 계정, 홈의 홈 화면 앱 안내)
export function DeviceLinkSheet({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<keyof typeof TITLES>('code')
  const row = (label: string, test: string, to: keyof typeof TITLES) => (
    <div className="list-row" data-test={test} onClick={() => setView(to)} style={{ padding: '14px 0', cursor: 'pointer' }}>
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{ color: 'var(--muted-2)' }}>›</span>
    </div>
  )
  return (
    <Sheet title={TITLES[view]} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {view === 'code' && <CodeView />}
        {view === 'load' && <LoadView />}
        {view === 'revoke' && <RevokeView onDone={onClose} />}
        {view === 'code' ? (
          <div className="list-card" style={{ padding: '0 16px' }}>
            {row('다른 기기의 기록을 이 기기로 불러오기', 'link-load', 'load')}
            {row('다른 기기 모두 연결 끊기', 'link-revoke', 'revoke')}
          </div>
        ) : (
          <button type="button" className="btn btn-plain" onClick={() => setView('code')}>
            코드 받기로 돌아가기
          </button>
        )}
      </div>
    </Sheet>
  )
}
