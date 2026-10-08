import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { badgeOf, displayName, useAuth, useMe, type Profile } from '../app/auth'
import { Screen } from '../app/Screen'
import { useUI } from '../app/ui'
import { useMyPostCount } from '../data/community'
import { useKeeper } from '../data/keeper'
import { squareImage, upload } from '../lib/media'
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupport } from '../lib/push'
import { errMsg, publicUrl, supabase } from '../lib/supabase'
import { Avatar, Seg, Sheet, Toggle } from '../ui/kit'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F3F1EB', borderRadius: 12, padding: '12px 14px' }}>
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
        <div className="hint">운영자에게 받은 코드를 입력하면 이 기기 계정에 운영자 권한(공지 작성 등)이 적용돼요.</div>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>기기 알림 (푸시)</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{sub}</div>
      </div>
      <Toggle label="기기 알림" on={on} busy={busy || !sup.ok} onClick={toggle} />
    </div>
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
  const [sheet, setSheet] = useState<null | 'profile' | 'admin'>(null)
  const badge = badgeOf(profile)

  const update = async (patch: Partial<Pick<Profile, 'coi_limit' | 'todo_alarm'>>) => {
    qc.setQueryData(['profile', uid], { ...profile, ...patch })
    const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
    if (error) ui.toast(errMsg(error, '설정을 저장하지 못했어요'), 'warn')
    qc.invalidateQueries({ queryKey: ['profile'] })
  }

  const row = (label: string, sub: string, to: () => void) => (
    <div key={label} className="list-row" onClick={to} style={{ padding: '14px 0' }}>
      <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>{sub}</span>
      <span style={{ color: 'var(--muted-2)' }}>›</span>
    </div>
  )

  const groups: [string, ReturnType<typeof row>[]][] = [
    [
      '사육 관리',
      [
        row('개체 등록·관리', `${k.owned.length}마리`, () => nav('/animals')),
        row('혈통 관리', '페어링 검사', () => nav('/lineage')),
        row('산란 관리', `${k.breeders.length}마리`, () => nav('/clutch')),
        row('체중 측정', '', () => nav('/weights')),
        row('오늘의 할 일', '', () => nav('/todo')),
      ],
    ],
    [
      '도구',
      [
        row('QR 라벨 스캔', '', () => nav('/scan')),
        row('분양 받기', '코드 입력', () => nav('/transfer')),
        row('공지사항', '', () => nav('/notices')),
        row('알림', '', () => nav('/alerts')),
      ],
    ],
    [
      '계정',
      [
        row('프로필 편집', '사진 · 닉네임 · 소개', () => setSheet('profile')),
        row(isAdmin ? '운영자 권한' : '관리자 코드 입력', isAdmin ? '적용됨' : '운영자 전용', () =>
          isAdmin ? ui.toast('이미 운영자 권한이 적용된 계정이에요') : setSheet('admin'),
        ),
      ],
    ],
  ]

  return (
    <Screen title="전체">
      <div className="page">
        <div data-test="profile-card" className="card card-pad" onClick={() => setSheet('profile')} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
          <Avatar name={displayName(profile)} url={profile.avatar_url} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{displayName(profile)}</span>
              {badge && <span className="tag dark">{badge}</span>}
            </div>
            {profile.bio && <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 3, overflowWrap: 'anywhere' }}>{profile.bio}</div>}
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              사육 중 {k.owned.length}마리 · 작성 글 {posts}
            </div>
          </div>
          <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--blue)', border: '1px solid var(--blue)', borderRadius: 999, padding: '6px 12px' }}>편집</span>
        </div>

        {groups.map(([title, items]) => (
          <div key={title}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '0 0 6px 4px' }}>{title}</div>
            <div className="list-card" style={{ padding: '0 16px' }}>
              {items}
            </div>
          </div>
        ))}

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '0 0 6px 4px' }}>설정</div>
          <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>근친 페어링 차단 기준 (COI 초과)</div>
              <Seg
                mono
                items={[
                  [3.125, '3.125%'],
                  [6.25, '6.25%'],
                  [12.5, '12.5%'],
                ]}
                value={Number(profile.coi_limit)}
                onChange={(v) => update({ coi_limit: v })}
              />
              <div className="hint" style={{ marginTop: 6 }}>
                6.25% = 사촌 간 페어링 수준 · 12.5% = 이복 남매 수준
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>할 일 사전 알림</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>설정한 시간 전에 알림함 · 배너 · 기기 알림으로 알려줘요</div>
              </div>
              <Toggle label="할 일 알림" on={profile.todo_alarm} onClick={() => update({ todo_alarm: !profile.todo_alarm })} />
            </div>
            <PushToggle />
          </div>
        </div>

        <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--muted-2)', textAlign: 'center' }}>
          VILLAIN ERA beta · 이 기기 게스트 계정
          <br />
          기록은 서버에 저장돼요 · 브라우저 데이터를 지우면 이 계정에 다시 들어올 수 없어요
          <br />
          로그인 기능이 추가되면 계정을 연결해 보관할 수 있어요
        </div>
      </div>
      {sheet === 'profile' && <ProfileSheet profile={profile} onClose={() => setSheet(null)} />}
      {sheet === 'admin' && <AdminCodeSheet onClose={() => setSheet(null)} />}
    </Screen>
  )
}
