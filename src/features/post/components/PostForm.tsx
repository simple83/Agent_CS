import { lazy, Suspense, useRef, type ChangeEvent, type FormEvent } from 'react';
import { usePostForm } from '../hooks/usePostForm';
import type { PostEntity } from '../types/post.types';
import { POST_CATEGORIES, isPostCategory, type PostCategory } from '../utils/postEditor';
import './PostBoard.css';

// 편집기 엔진은 작성 화면에 진입할 때만 내려받아 목록의 최초 로딩 비용을 줄인다.
// 컴포넌트 외부에 선언하여 부모가 렌더링되어도 편집기와 입력 위치가 유지되게 한다.
const PostEditor = lazy(() => import('./PostEditor').then((module) => ({ default: module.PostEditor })));

interface PostFormProps {
  /** 저장 성공 알림을 Page에 반환하여 화면 전환 책임을 분리한다. */
  onCreated?: (post: PostEntity) => void;
  /** 목록에서 전달한 최초 말머리이며 작성 중 선택은 Hook이 관리한다. */
  initialCategory?: PostCategory;
}

/**
 * 제목·말머리·본문·첨부 파일을 모으는 작성 화면이다.
 * 시각적 편집기가 변환한 Markdown을 기존 Hook에 넘기므로 API 계약은 바뀌지 않는다.
 * 코드는 본문에서 바로 편집하므로 별도 코드 초안이나 삽입 대기 상태가 필요 없다.
 */
export const PostForm = ({ onCreated, initialCategory }: PostFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    title, content, category, hashtagInput, hashtags, images, isLoading, error,
    setTitle, setContent, setCategory, setHashtagInput, setImages, submit,
  } = usePostForm({ onCreated, initialCategory });

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
    <form onSubmit={handleSubmit} className="post-compose">
      <header className="board-heading">
        <h2>새 게시글 작성</h2>
        <p>코드와 지식을 나누고, 학과 친구들과 이야기해 보세요.</p>
      </header>

      <div className="post-title-row">
        <label>말머리
          <select value={category} disabled={isLoading} onChange={(event) => {
            if (isPostCategory(event.target.value)) setCategory(event.target.value);
          }}>
            {POST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>제목 *
          <input value={title} onChange={(event) => setTitle(event.target.value)}
            disabled={isLoading} placeholder="제목을 입력해 주세요." />
        </label>
      </div>

      <Suspense fallback={<p role="status">본문 편집기를 준비하고 있습니다...</p>}>
        <PostEditor content={content} onChange={setContent} disabled={isLoading} />
      </Suspense>

      {/* 첨부는 기존 multipart images 필드로 전송한다. 본문 안에 이미지 주소를 넣지 않는다. */}
      <section className="post-attachments" aria-label="이미지 첨부">
        <label htmlFor="post-images">이미지 첨부</label>
        <p className="post-help">첨부 이미지는 본문 위에 모아서 표시됩니다. 본문 중간 삽입은 아직 지원하지 않습니다.</p>
        <input id="post-images" ref={fileInputRef} type="file"
          accept="image/png,image/jpeg,image/gif,image/webp" multiple disabled={isLoading}
          onChange={handleImageChange} />
        {images.length > 0 && <ul className="attachment-list">
          {images.map((file, index) => <li key={`${index}-${file.name}`}>
            <span>{file.name} · {Math.ceil(file.size / 1024)}KB</span>
            <button type="button" disabled={isLoading} aria-label={`${file.name} 첨부 제거`}
              onClick={() => setImages(images.filter((_, position) => position !== index))}>제거</button>
          </li>)}
        </ul>}
      </section>

      <label>주제 태그
        <input value={hashtagInput} onChange={(event) => setHashtagInput(event.target.value)}
          disabled={isLoading} placeholder="React, TypeScript, 자료구조" />
      </label>
      <p className="post-help">쉼표로 구분합니다. 말머리는 위에서 하나만 선택하고, 여기는 구체적인 주제를 적어 주세요.</p>
      <div className="post-tag-preview" aria-label="저장할 태그">
        {hashtags.map((tag) => <span key={tag}>#{tag}</span>)}
      </div>

      {error && <p className="post-error" role="alert">{error}</p>}
      <div className="post-actions">
        <button type="submit" className="primary" disabled={isLoading}>
          {isLoading ? '등록 중...' : '게시글 등록'}
        </button>
      </div>
    </form>
  );
};
