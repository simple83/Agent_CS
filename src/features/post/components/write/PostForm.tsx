import { lazy, Suspense, type FormEvent } from 'react';
import { usePostForm } from '../../hooks/usePostForm';
import type { PostEntity } from '../../types/post.types';
import { POST_CATEGORIES, isPostCategory, type PostCategory } from '../../utils/postEditor';
import styles from './PostForm.module.css';
import layout from '../../styles/PostLayout.module.css';
import ui from '../../../../shared/styles/Controls.module.css';

// 편집기 엔진은 작성 화면에 진입할 때만 내려받아 목록의 최초 로딩 비용을 줄인다.
// 컴포넌트 외부에 선언하여 부모가 렌더링되어도 편집기와 입력 위치가 유지되게 한다.
const PostEditor = lazy(() => import('../../../../shared/components/richText/RichTextEditor').then((module) => ({ default: module.RichTextEditor })));

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
 * 작성과 수정이 공유하는 제목·말머리·본문 폼이다. 수정에서도 본문 이미지 위치와 기존 이미지 ID를 보존한다.
 * 시각적 편집기가 변환한 Markdown을 기존 Hook에 넘기므로 서비스에서 이미지 임시 참조와 파일을 함께 전송한다.
 * 코드는 본문에서 바로 편집하므로 별도 코드 초안이나 삽입 대기 상태가 필요 없다.
 */
export const PostForm = ({ onCreated, initialCategory, initialPost, onUpdated, onCancel }: PostFormProps) => {
  const isEditing = Boolean(initialPost);
  const {
    title, content, category, hashtagInput, hashtags, addImages, isLoading, error,
    setTitle, setContent, setCategory, setHashtagInput, submit,
  } = usePostForm({ onCreated, initialCategory, initialPost, onUpdated });

  /** 기본 페이지 전송을 막고 Hook의 저장 흐름으로 전달한다. 성공할 때만 파일 입력을 비운다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
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
        <PostEditor content={content} onChange={setContent} disabled={isLoading} onImageFiles={addImages} />
      </Suspense>

      <p className={ui.help}>도구 모음의 이미지 버튼으로 커서 위치에 삽입합니다. 본문에서 이미지를 삭제하면 저장할 때 반영됩니다. 새 이미지는 요청당 최대 10개입니다.</p>

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
