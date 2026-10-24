import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { usePostForm } from '../hooks/usePostForm';
import type { PostEntity } from '../types/post.types';
import { POST_CATEGORIES, isPostCategory, type PostCategory } from '../utils/postEditor';
import { PostEditor } from './PostEditor';
import './PostBoard.css';

interface PostFormProps {
  /** 저장 성공 알림을 Page에 반환하여, 화면 전환에 대한 책임을 분리한다. */
  onCreated?: (post: PostEntity) => void;
  /** 목록에서 전달한 최초 말머리이며, 작성 중의 선택은 Hook이 관리한다. */
  initialCategory?: PostCategory;
}

/**
 * 제목·말머리·본문·첨부 파일을 모으는 작성 화면이다.
 * 저장/검증은 usePostForm에 맡기고, 아직 본문에 삽입하지 않은 코드는 별도로 보존한다.
 * 코드 초안이 남아 있으면 등록을 막아 사용자가 작성한 내용이 빠지는 것을 방지한다.
 */
export const PostForm = ({ onCreated, initialCategory }: PostFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 본문과 별도로 입력한 코드가 조용히 누락되지 않도록 부모가 초안 상태를 관리한다.
  const [codeDraft, setCodeDraft] = useState('');
  const hasPendingCode = Boolean(codeDraft.trim());
  const { title, content, category, hashtagInput, hashtags, images, isLoading, error,
    setTitle, setContent, setCategory, setHashtagInput, setImages, submit,
  } = usePostForm({ onCreated, initialCategory });

  /** 브라우저의 기본 페이지 전송을 막고, Hook의 검증/저장 흐름으로 전달한다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 버튼 비활성화뿐 아니라 Enter 또는 프로그램에 의한 form 제출도 검사한다.
    if (hasPendingCode) return;
    const createdPost = await submit();
    if (createdPost && fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * 여러 번 선택한 파일을 누적한다. 파일 선택 UI의 값은 비워 같은 파일도 다시 고를 수 있다.
   * accept는 선택 편의 기능일 뿐 보안 검증이 아니다. 실제 형식/용량/권한 검사는 서버가 해야 한다.
   */
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    setImages((previous) => [...previous, ...selectedFiles]);
    event.target.value = '';
  };

  return <form onSubmit={handleSubmit} className="post-compose">
    <header className="board-heading"><h2>새 게시글 작성</h2><p>코드와 지식을 나누고, 학과 친구들과 이야기해 보세요.</p></header>
    <div className="post-title-row">
      <label>말머리<select value={category} disabled={isLoading} onChange={(event) => {
        if (isPostCategory(event.target.value)) setCategory(event.target.value);
      }}>{POST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>제목 *<input value={title} onChange={(event) => setTitle(event.target.value)} disabled={isLoading} placeholder="제목을 입력해 주세요." /></label>
    </div>
    <PostEditor content={content} onChange={setContent} disabled={isLoading}
      codeDraft={codeDraft} onCodeDraftChange={setCodeDraft} />
    {hasPendingCode && <p className="post-help" role="status">본문에 넣지 않은 코드가 있습니다. 코드 메뉴에서 삽입하거나 입력을 비워 주세요.</p>}
    <section className="post-attachments" aria-label="이미지 첨부">
      <label htmlFor="post-images">이미지 첨부</label>
      <p className="post-help">첨부 이미지는 본문 위에 모아서 표시됩니다. 본문 중간 삽입은 아직 지원하지 않습니다.</p>
      <input id="post-images" ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple disabled={isLoading}
        onChange={handleImageChange} />
      {images.length > 0 && <ul className="attachment-list">{images.map((file, index) => <li key={`${index}-${file.name}`}>
        <span>{file.name} · {Math.ceil(file.size / 1024)}KB</span>
        <button type="button" disabled={isLoading} aria-label={`${file.name} 첨부 제거`} onClick={() => setImages(images.filter((_, position) => position !== index))}>제거</button>
      </li>)}</ul>}
    </section>
    <label>주제 태그<input value={hashtagInput} onChange={(event) => setHashtagInput(event.target.value)} disabled={isLoading} placeholder="React, TypeScript, 자료구조" /></label>
    <p className="post-help">쉼표로 구분합니다. 말머리는 위에서 하나만 선택하고, 여기는 구체적인 주제를 적어 주세요.</p>
    <div className="post-tag-preview" aria-label="저장할 태그">{hashtags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
    {error && <p className="post-error" role="alert">{error}</p>}
    <div className="post-actions"><button type="submit" className="primary" disabled={isLoading || hasPendingCode}>{isLoading ? '등록 중...' : '게시글 등록'}</button></div>
  </form>;
};
