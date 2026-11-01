import { lazy, Suspense, useRef, type ChangeEvent, type FormEvent } from 'react';
import { usePostForm } from '../../hooks/usePostForm';
import type { PostEntity } from '../../types/post.types';
import { POST_CATEGORIES, isPostCategory, type PostCategory } from '../../utils/postEditor';
import styles from './PostForm.module.css';
import layout from '../../styles/PostLayout.module.css';
import ui from '../../../../shared/styles/Controls.module.css';

// 편집기 엔진은 작성 화면에 진입할 때만 내려받아 목록의 최초 로딩 비용을 줄인다.
// 컴포넌트 외부에 선언하여 부모가 렌더링되어도 편집기와 입력 위치가 유지되게 한다.
const PostEditor = lazy(() => import('./editor/PostEditor').then((module) => ({ default: module.PostEditor })));

interface PostFormProps {
  /** 저장 성공 알림을 Page에 반환하여 화면 전환 책임을 분리한다. */
  onCreated?: (post: PostEntity) => void;
  /** 목록에서 전달한 최초 말머리이며 작성 중 선택은 Hook이 관리한다. */
  initialCategory?: PostCategory;
  /** 수정할 원본이다. 조회 완료 후 마운트하고 글 번호가 바뀌면 key로 폼을 교체한다. */
  initialPost?: PostEntity;
  /** 수정 저장과 취소 후의 이동은 Page가 처리한다. */
  onUpdated?: (post: PostEntity) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * 작성과 수정이 공유하는 제목·말머리·본문 폼이다. 수정에서는 기존 이미지를 읽기 전용으로 보여준다.
 * 시각적 편집기가 변환한 Markdown을 기존 Hook에 넘기므로 API 계약은 바뀌지 않는다.
 * 코드는 본문에서 바로 편집하므로 별도 코드 초안이나 삽입 대기 상태가 필요 없다.
 */
export const PostForm = ({ onCreated, initialCategory, initialPost, onUpdated, onCancel }: PostFormProps) => {
  const isEditing = Boolean(initialPost);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    title, content, category, hashtagInput, hashtags, images, isLoading, error,
    setTitle, setContent, setCategory, setHashtagInput, setImages, submit,
  } = usePostForm({ onCreated, initialCategory, initialPost, onUpdated });

  /** 기본 페이지 전송을 막고 Hook의 저장 흐름으로 전달한다. 성공할 때만 파일 입력을 비운다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const createdPost = await submit();
    if (createdPost && fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * 여러 번 선택한 파일을 누적한다. 입력 값을 비워 같은 파일도 다시 고를 수 있게 한다.
   * accept는 선택 편의 기능이며 실제 형식/용량/권한 검사는 서버가 담당해야 한다.
   */
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    setImages((previous) => [...previous, ...selectedFiles]);
    event.target.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className={`${layout.page} ${styles.form}`}>
      <header className={layout.heading}>
        <h2>{isEditing ? '게시글 수정' : '새 게시글 작성'}</h2>
        <p>{isEditing ? '제목과 본문, 말머리와 주제 태그를 수정할 수 있습니다.' : '코드와 지식을 나누고, 학과 친구들과 이야기해 보세요.'}</p>
      </header>

      <div className={styles.titleRow}>
        <label className={ui.field}>말머리
          <select className={ui.input} value={category} disabled={isLoading} onChange={(event) => {
            if (isPostCategory(event.target.value)) setCategory(event.target.value);
          }}>
            {POST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className={ui.field}>제목 *
          <input className={ui.input} value={title} onChange={(event) => setTitle(event.target.value)}
            disabled={isLoading} placeholder="제목을 입력해 주세요." />
        </label>
      </div>

      <Suspense fallback={<p role="status">본문 편집기를 준비하고 있습니다...</p>}>
        <PostEditor content={content} onChange={setContent} disabled={isLoading} imageAttachmentAvailable={!isEditing} />
      </Suspense>

      {/* 수정 시 파일 선택을 제공하지 않으며 기존 URL을 File로 바꾸거나 재전송하지 않는다. */}
      {initialPost ? <section className={styles.attachments} aria-label="기존 첨부 이미지">
        <span className={ui.field}>기존 첨부 이미지</span>
        <p className={ui.help}>기존 이미지는 그대로 유지됩니다. 수정 화면에서 이미지 추가·교체·삭제는 아직 지원하지 않습니다.</p>
        {initialPost.image_urls.length ? <div className={styles.existingImages}>
          {initialPost.image_urls.map((url, index) => <img key={`${index}-${url}`} src={url}
            alt={`기존 첨부 이미지 ${index + 1}`} className={styles.existingImage} />)}
        </div> : <p className={ui.help}>첨부된 이미지가 없습니다.</p>}
      </section> :
      /* 새 글의 첨부는 기존 multipart images 필드로 전송한다. */
      <section className={styles.attachments} aria-label="이미지 첨부">
        <label className={ui.field} htmlFor="post-images">이미지 첨부</label>
        <p className={ui.help}>첨부 이미지는 본문 위에 모아서 표시됩니다. 본문 중간 삽입은 아직 지원하지 않습니다.</p>
        <input className={styles.fileInput} id="post-images" ref={fileInputRef} type="file"
          accept="image/png,image/jpeg,image/gif,image/webp" multiple disabled={isLoading}
          onChange={handleImageChange} />
        {images.length > 0 && <ul className={styles.attachmentList}>
          {images.map((file, index) => <li key={`${index}-${file.name}`}>
            <span>{file.name} · {Math.ceil(file.size / 1024)}KB</span>
            <button className={ui.button} type="button" disabled={isLoading} aria-label={`${file.name} 첨부 제거`}
              onClick={() => setImages(images.filter((_, position) => position !== index))}>제거</button>
          </li>)}
        </ul>}
      </section>}

      <label className={ui.field}>주제 태그
        <input className={ui.input} value={hashtagInput} onChange={(event) => setHashtagInput(event.target.value)}
          disabled={isLoading} placeholder="React, TypeScript, 자료구조" />
      </label>
      <p className={ui.help}>{isEditing
        ? '쉼표로 구분합니다. 기존 태그를 직접 지울 수 있으며, 말머리를 변경하면 기존 말머리 태그는 선택한 하나로 정리됩니다.'
        : '쉼표로 구분합니다. 말머리는 위에서 하나만 선택하고, 여기는 구체적인 주제를 적어 주세요.'}</p>
      <div className={styles.tags} aria-label="저장할 태그">
        {hashtags.map((tag) => <span className={ui.badge} key={tag}>#{tag}</span>)}
      </div>

      {error && <p className={ui.error} role="alert">{error}</p>}
      <div className={ui.actions}>
        {onCancel && <button type="button" className={ui.button} disabled={isLoading} onClick={onCancel}>취소</button>}
        <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={isLoading}>
          {isEditing ? (isLoading ? '저장 중...' : '수정 저장') : (isLoading ? '등록 중...' : '게시글 등록')}
        </button>
      </div>
    </form>
  );
};
