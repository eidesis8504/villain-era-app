import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Award, Ban, Bell, ChartColumn, ChevronRight, CircleHelp, LogIn, Megaphone, ScanLine, Send, Shield, Smartphone, Trash2, UserRound } from 'lucide-react'
import { badgeOf, displayName, useAuth, useMe, type Profile } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useMyPostCount, useNotifications } from '../data/community'
import { useKeeper } from '../data/keeper'
import { squareImage, upload } from '../lib/media'
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupport } from '../lib/push'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { tierOf } from '../lib/tier'
import { isNative } from '../lib/native'
import { APP_VERSION } from '../lib/version'
import { Avatar, Seg, Sheet, Toggle } from '../ui/kit'
import { DeleteAccountSheet } from './DeleteAccountSheet'
import { DeviceLinkSheet } from './DeviceLinkSheets'
import { FeedbackSheet } from './FeedbackSheet'
import { TierBadge } from './TierViews'

function ProfileSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const ui = useUI()
  const qc = useQueryClient()
  const { uid } = useMe()
  const [name, setName] = useState(profile.nickname ?? '')
  const [bio, setBio] = useState(profile.bio)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [photoUrl, setPhotoUrl] = useState(profile.avatar_url)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const nOk = name.trim().length >= 2 && name.trim().length <= 12
  const shown = photo?.url ?? photoUrl
  const badge = badgeOf(profile)

  const save = async () => {
    if (!nOk) return setTried(true)
    setBusy(true)
    try {
      let avatar = photoUrl
      if (photo) avatar = publicUrl('avatars', await upload('avatars', uid, photo.blob, 'jpg'))
      const { error } = await supabase.from('profiles').update({ nickname: name.trim(), bio: bio.trim(), avatar_url: avatar }).eq('id', uid)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['profile'] })
      await qc.invalidateQueries({ queryKey: ['posts'] })
      ui.toast('프로필을 저장했어요')
      onClose()
    } catch (e) {
      setBusy(false)
      ui.toast(errMsg(e, '프로필을 저장하지 못했어요'), 'warn')
    }
  }

  return (
    <Sheet title="프로필 편집" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={name || '사'} url={shown} size={84} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            <label className="btn btn-primary" style={{ height: 44, fontSize: 14, cursor: 'pointer' }}>
              {shown ? '사진 변경' : '사진 추가'}
              <input
                data-test="profile-photo"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const blob = await squareImage(f, 320)
                    setPhoto({ blob, url: URL.createObjectURL(blob) })
                  } catch (err) {
                    ui.toast(errMsg(err, '사진을 읽을 수 없어요'), 'warn')
                  }
                }}
              />
            </label>
            {shown && (
              <button
                type="button"
                className="btn btn-plain"
                style={{ height: 44, fontSize: 14, color: 'var(--warn)' }}
                onClick={() => {
                  setPhoto(null)
                  setPhotoUrl(null)
                }}
              >
                사진 삭제
              </button>
            )}
          </div>
        </div>
        <div>
          <div className="label">닉네임</div>
          <input
            data-test="profile-name"
            className={`input${tried && !nOk ? ' bad' : ''}`}
            style={{ height: 48 }}
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임 (2–12자)"
          />
        </div>
        <div>
          <div className="label">
            소개 <span style={{ fontWeight: 400, color: 'var(--muted-2)' }}>· 선택 · {bio.length}/60</span>
          </div>
          <textarea
            data-test="profile-bio"
            className="input"
            style={{ height: 76, fontSize: 15, lineHeight: 1.5 }}
            value={bio}
            maxLength={60}
            onChange={(e) => setBio(e.target.value.slice(0, 60))}
            placeholder="예: 크레스티드게코 7마리 · 릴리화이트 라인 브리딩"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F3F1EB', borderRadius: 10, padding: '12px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sub)' }}>등급</span>
          {badge ? (
            <span className="tag dark" style={{ fontSize: 12, padding: '3px 9px', borderRadius: 6 }}>
              {badge}
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>일반 회원</span>
          )}
        </div>
        {tried && !nOk && <div className="err">닉네임은 2–12자로 입력해 주세요</div>}
        <button type="button" data-test="profile-save" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </Sheet>
  )
}

function AdminCodeSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI()
  const { refreshProfile } = useAuth()
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const apply = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('apply_admin_code', { p_code: code })
    setBusy(false)
    if (error) return setErr(errMsg(error, '관리자 코드를 확인해 주세요'))
    await refreshProfile()
    ui.toast('운영자 권한이 적용됐어요')
    onClose()
  }
  return (
    <Sheet title="관리자 코드" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hint">운영자에게 받은 코드를 입력하면 이 계정에 운영자 권한(공지 작성 등)이 적용돼요.</div>
        <input
          className="input mono"
          style={{ letterSpacing: '.08em', fontWeight: 600 }}
          value={code}
          maxLength={16}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setErr('')
          }}
          placeholder="코드 8자리"
        />
        {err && <div className="err">{err}</div>}
        <button type="button" className="btn btn-primary" onClick={apply} disabled={busy || code.trim().length < 4}>
          적용
        </button>
      </div>
    </Sheet>
  )
}

function PushToggle() {
  const ui = useUI()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const sup = pushSupport()

  useEffect(() => {
    currentSubscription().then((s) => setOn(!!s && Notification.permission === 'granted'))
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      if (on) {
        await disablePush()
        setOn(false)
        ui.toast('기기 알림을 껐어요')
      } else {
        await enablePush()
        setOn(true)
        ui.toast('기기 알림이 켜졌어요 · 앱을 닫아도 할 일 알림이 와요')
      }
    } catch (e) {
      ui.toast(errMsg(e, '기기 알림을 켜지 못했어요'), 'warn')
    } finally {
      setBusy(false)
    }
  }

  const sub = !sup.ok
    ? sup.reason
    : on
      ? '앱을 닫아도 할 일·댓글·공지 알림을 받아요'
      : isIOS() && !isStandalone()
        ? '홈 화면에 추가한 앱에서 켜 주세요'
        : '켜면 알림 권한을 요청해요'

  return (
    <>
      <div className="grow">
        <div className="row-t">기기 알림 (푸시)</div>
        <div className="meta">{sub}</div>
      </div>
      <Toggle label="기기 알림" on={on} busy={busy || !sup.ok} onClick={toggle} />
    </>
  )
}

export default function MorePage() {
  const nav = useNavigate()
  const ui = useUI()
  const qc = useQueryClient()
  const { profile, uid } = useMe()
  const { isAdmin } = useAuth()
  const k = useKeeper()
  const posts = useMyPostCount().data ?? 0
  const [sheet, setSheet] = useState<null | 'profile' | 'admin' | 'feedback' | 'delete' | 'link'>(null)
  const badge = badgeOf(profile)

  const update = async (patch: Partial<Pick<Profile, 'coi_limit' | 'todo_alarm'>>) => {
    qc.setQueryData(['profile', uid], { ...profile, ...patch })
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
    if (error) ui.toast(errMsg(error, '설정을 저장하지 못했어요'), 'warn')
    qc.invalidateQueries({ queryKey: ['profile'] })
  }

  const unread = (useNotifications().data ?? []).filter((n) => !n.read_at).length

  const row = (id: string, label: string, sub: string, to: () => void, icon?: ReactNode, warn = false) => (
    <button type="button" key={id} className="row" data-test={`more-${id}`} onClick={to}>
      {icon && <span className={`row-ic${warn ? ' warn' : ''}`}>{icon}</span>}
      <span className={`row-t grow${warn ? ' warn' : ''}`}>{label}</span>
      {sub && <span className="row-v">{sub}</span>}
      <ChevronRight size={18} className="chev" />
    </button>
  )

  // 사육 관리 도구(급여·체중·산란·혈통·할 일)는 홈의 '사육 관리'와 하단 기록 버튼에 있다.
  // 묶음 이름 '설정'·'계정'은 앱 안 글이 '전체 › 설정', '전체 › 계정'으로 안내하므로 그대로 둔다
  const top = [
    row('tier', '내 등급', `${tierOf(profile.hz).name} · ${profile.hz} Hz`, () => nav('/tier'), <Award size={20} />),
    row('alerts', '알림', unread ? `새 알림 ${unread}` : '', () => nav('/alerts'), <Bell size={20} />),
    row('notices', '공지사항', '', () => nav('/notices'), <Megaphone size={20} />),
  ]
  const tools = [
    row('scan', 'QR 스캔', '', () => nav('/scan'), <ScanLine size={20} />),
    row('transfer', '분양 받기', '코드 입력', () => nav('/transfer'), <LogIn size={20} />),
  ]
  const groups: [string, ReturnType<typeof row>[]][] = [
    [
      '지원',
      [
        row('inquiry', '도움말·문의', '운영자에게 문의', () => nav('/inquiry'), <CircleHelp size={20} />),
        row('feedback', '의견 보내기', '불편한 점 · 바라는 기능', () => setSheet('feedback'), <Send size={20} />),
      ],
    ],
    [
      '약관과 정책',
      [
        row('privacy', '개인정보 처리방침', '', () => nav('/privacy')),
        row('terms', '이용약관', '', () => nav('/terms')),
        row('policy', '커뮤니티 운영정책', '', () => nav('/policy')),
      ],
    ],
    [
      '계정',
      [
        row('profile', '프로필 편집', '사진 · 닉네임 · 소개', () => setSheet('profile'), <UserRound size={20} />),
        row('link', '다른 기기에서 이어 쓰기', '코드로 연결', () => setSheet('link'), <Smartphone size={20} />),
        row('blocked', '차단 관리', '', () => nav('/blocked'), <Ban size={20} />),
        ...(isAdmin ? [row('admin', '검증 현황', '운영자 전용', () => nav('/admin'), <ChartColumn size={20} />)] : []),
        row(
          'admin-code',
          isAdmin ? '운영자 권한' : '관리자 코드 입력',
          isAdmin ? '적용됨' : '운영자 전용',
          () => (isAdmin ? ui.toast('이미 운영자 권한이 적용된 계정이에요') : setSheet('admin')),
          <Shield size={20} />,
        ),
        row('delete', '계정과 기록 삭제', '되돌릴 수 없어요', () => setSheet('delete'), <Trash2 size={20} />, true),
      ],
    ],
  ]

  return (
    <Screen title="전체" back="/">
      <div className="page" style={{ gap: 0 }}>
        <div data-test="profile-card" className="row" style={{ paddingTop: 8 }} onClick={() => setSheet('profile')}>
          <Avatar name={displayName(profile)} url={profile.avatar_url} size={56} />
          <div className="grow">
            <div className="nm" style={{ fontSize: 18, lineHeight: '26px', alignItems: 'center' }}>
              <span>{displayName(profile)}</span>
              {badge && <span className="tag dark">{badge}</span>}
              {!isAdmin && <TierBadge hz={profile.hz} />}
            </div>
            {profile.bio && <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 2, overflowWrap: 'anywhere' }}>{profile.bio}</div>}
            <div className="meta">
              사육 중 {k.owned.length}마리 · 작성 글 {posts}
            </div>
          </div>
          <span className="btn btn-outline btn-xs">편집</span>
        </div>

        <div className="rows" style={{ marginTop: 8 }}>
          {top}
        </div>

        <div className="grp">도구</div>
        <div className="rows">{tools}</div>

        <div className="grp">설정</div>
        <div className="rows">
          <div className="row" style={{ display: 'block', cursor: 'default' }}>
            <div className="row-t">근친 페어링 차단 기준 (COI 초과)</div>
            <div style={{ marginTop: 8 }}>
              <Seg
                items={[
                  [3.125, '3.125%'],
                  [6.25, '6.25%'],
                  [12.5, '12.5%'],
                ]}
                value={Number(profile.coi_limit)}
                onChange={(v) => update({ coi_limit: v })}
              />
            </div>
            <div className="meta" style={{ marginTop: 8 }}>
              6.25% = 사촌 간 페어링 수준 · 12.5% = 이복 남매 수준
            </div>
          </div>
          <div className="row" style={{ cursor: 'default' }}>
            <div className="grow">
              <div className="row-t">할 일 사전 알림</div>
              <div className="meta">설정한 시간 전에 알림함 · 배너 · 기기 알림으로 알려줘요</div>
            </div>
            <Toggle label="할 일 알림" on={profile.todo_alarm} onClick={() => update({ todo_alarm: !profile.todo_alarm })} />
          </div>
          <div className="row" style={{ cursor: 'default' }}>
            {isNative() ? (
              <div className="grow">
                <div className="row-t">기기 알림</div>
                <div className="meta">스토어 앱의 기기 알림은 정식 버전에서 지원해요 · 알림함과 앱 안 배너로는 계속 알려 드려요</div>
              </div>
            ) : (
              <PushToggle />
            )}
          </div>
        </div>

        {groups.map(([title, items]) => (
          <div key={title}>
            <div className="grp">{title}</div>
            <div className="rows">{items}</div>
          </div>
        ))}

        <p className="meta" style={{ margin: '28px 0 0', lineHeight: 1.7 }}>
          VILLAIN ERA {APP_VERSION} · 게스트 계정
          <br />
          기록은 서버에 저장돼요 · 다른 기기에서도 쓰려면 ‘다른 기기에서 이어 쓰기’
          <br />
          이 기기 데이터를 지우기 전에 다른 기기에 연결해 두세요
        </p>
      </div>
      {sheet === 'profile' && <ProfileSheet profile={profile} onClose={() => setSheet(null)} />}
      {sheet === 'admin' && <AdminCodeSheet onClose={() => setSheet(null)} />}
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteAccountSheet onClose={() => setSheet(null)} />}
      {sheet === 'link' && <DeviceLinkSheet onClose={() => setSheet(null)} />}
    </Screen>
  )
}
