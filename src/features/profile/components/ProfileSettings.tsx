import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProfileUpdate, UserProfile } from '../types/profile.types';
import { validateProfileImage, validateProfileUpdate } from '../utils/profileContract';
import { useProfileActions } from '../hooks/useProfileActions';
import { isImageUrl } from '../../../shared/components/richText/markdownImages';
import ui from '../../../shared/styles/Controls.module.css';
import styles from './ProfileSettings.module.css';

interface Props { profile: UserProfile; token: string; onWithdrawn: () => void }

/** 내 정보만 표시한다. 이메일은 이 화면에만 노출하며 게시글 작성자 정보로 전달하지 않는다. */
export const ProfileSettings = ({ profile: initial, token, onWithdrawn }: Props) => {
  const [profile, setProfile] = useState(initial);
  const [username, setUsername] = useState(initial.username ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');
  const [inputError, setInputError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { save, withdraw, busy, error } = useProfileActions(token, onWithdrawn);

  // 사진 선택을 교체하거나 화면을 닫으면 blob URL을 해제한다. 비밀번호·사진은 별도 영구 저장하지 않는다.
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  /** 변경한 정보만 PATCH한다. 빈 선택 필드를 실수로 보내 기존 값을 덮어쓰지 않는다. */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setMessage('');
    setInputError('');
    const input: ProfileUpdate = {};
    for (const [key, value] of [['username', username], ['email', email], ['bio', bio]] as const) {
      const next = key === 'bio' ? value : value.trim();
      if (next !== (profile[key] ?? '')) input[key] = next;
    }
    if (image) input.profile_image = image;
    try { validateProfileUpdate(input); }
    catch (reason) { setInputError(reason instanceof Error ? reason.message : '입력값을 확인해주세요.'); return; }
    if (!Object.keys(input).length) { setMessage('변경한 내용이 없습니다.'); return; }
    const saved = await save(input);
    if (!saved) return;
    setProfile(saved);
    setUsername(saved.username ?? ''); setEmail(saved.email ?? ''); setBio(saved.bio ?? '');
    setImage(null);
    setPreview('');
    if (fileInput.current) fileInput.current.value = '';
    setMessage('프로필을 저장했습니다.');
  };

  /** 확인 체크와 비밀번호가 모두 있어야 탈퇴를 요청한다. 제출 뒤 비밀번호는 성공·실패와 무관하게 비운다. */
  const submitWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !confirmed || !password) return;
    try { await withdraw(password); } finally { setPassword(''); }
  };

  const source = image ? preview : profile.profile_image_url;
  return <main className={styles.page}>
    <h2>내 프로필</h2>
    <dl className={styles.identity}>
      <dt>아이디</dt><dd>{profile.account_id}</dd>
      <dt>가입일</dt><dd>{new Date(profile.created_at).toLocaleDateString('ko-KR')}</dd>
    </dl>

    <form onSubmit={submit} className={styles.form} aria-label="프로필 수정" noValidate>
      {source && isImageUrl(source, true) ? <img className={styles.avatar} src={source} alt="프로필 사진" referrerPolicy="no-referrer" />
        : <div className={styles.placeholder} aria-label="프로필 사진 없음">{(profile.username || profile.account_id).slice(0, 1)}</div>}
      <label className={ui.field}>프로필 사진
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={busy || withdrawing}
          aria-describedby="profile-image-help" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try { validateProfileImage(file); setImage(file); setPreview(URL.createObjectURL(file)); setInputError(''); setMessage(''); }
            catch (reason) { setInputError(reason instanceof Error ? reason.message : '사진을 확인해주세요.'); event.target.value = ''; }
          }} />
      </label>
      <p id="profile-image-help" className={ui.help}>JPG, PNG, GIF, WebP · 최대 5MB. 저장하면 새 사진으로 변경됩니다.</p>
      {image && <button type="button" className={ui.button} disabled={busy || withdrawing} onClick={() => {
        setImage(null); setPreview(''); if (fileInput.current) fileInput.current.value = '';
      }}>사진 선택 취소</button>}
      <label className={ui.field}>닉네임
        <input className={ui.input} name="username" autoComplete="nickname" value={username} disabled={busy || withdrawing} onChange={(event) => setUsername(event.target.value)} />
      </label>
      <label className={ui.field}>이메일
        <input className={ui.input} name="email" type="email" autoComplete="email" value={email} disabled={busy || withdrawing} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className={ui.field}>자기소개
        <textarea className={ui.input} name="bio" rows={5} value={bio} disabled={busy || withdrawing} onChange={(event) => setBio(event.target.value)} />
      </label>
      <div className={ui.actions}><button type="submit" className={`${ui.button} ${ui.primary}`} disabled={busy || withdrawing}>{busy && !withdrawing ? '저장 중...' : '프로필 저장'}</button></div>
    </form>

    {inputError && <p className={ui.error} role="alert">{inputError}</p>}
    {error && <p className={ui.error} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}

    <section className={styles.withdrawal} aria-label="회원 탈퇴">
      <h3>회원 탈퇴</h3>
      <p>탈퇴하면 계정이 비활성화되고 모든 로그인 세션이 종료됩니다. 탈퇴 후에는 이 계정으로 로그인할 수 없습니다.</p>
      {/* 백엔드 협의 전까지 게시글·댓글·파일의 자동 삭제나 익명화를 약속하지 않는다. */}
      <p className={ui.help}>탈퇴가 작성한 게시글·댓글의 삭제를 의미하지는 않습니다.</p>
      {!withdrawing ? <button type="button" className={ui.button} disabled={busy} onClick={() => { setWithdrawing(true); setMessage(''); }}>회원 탈퇴 진행</button>
        : <form onSubmit={submitWithdrawal} className={styles.form} aria-label="회원 탈퇴 확인">
          <label className={ui.field}>현재 비밀번호
            <input className={ui.input} name="withdraw_password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /> 탈퇴 안내를 확인했으며 회원 탈퇴에 동의합니다.</label>
          <div className={ui.actions}>
            <button type="button" className={ui.button} disabled={busy} onClick={() => { setWithdrawing(false); setPassword(''); setConfirmed(false); }}>취소</button>
            <button type="submit" className={`${ui.button} ${styles.danger}`} disabled={busy || !confirmed || !password}>{busy ? '탈퇴 처리 중...' : '회원 탈퇴 확정'}</button>
          </div>
        </form>}
    </section>
  </main>;
};
