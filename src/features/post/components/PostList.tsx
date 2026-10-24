import { useState, type FormEvent } from 'react';
import { usePostList } from '../hooks/usePostList';
import { POST_CATEGORIES, getPostCategory, type PostCategory } from '../utils/postEditor';
import './PostBoard.css';

interface PostListProps {
  onPostClick?: (postId: number) => void;
  category?: PostCategory | '';
  onCategoryChange?: (category: PostCategory | '') => void;
  onCreate?: () => void;
}

/**
 * 말머리 필터·검색·표 목록을 표시한다. URL 변경과 화면 이동은 Page에서 전달한 콜백으로 처리한다.
 * 말머리는 전체 검색 결과에 클라이언트에서 적용한다. 서버가 페이지네이션을 도입하면 이 방식도 수정해야 한다.
 */
export const PostList = ({ onPostClick, category = '', onCategoryChange, onCreate }: PostListProps) => {
  const { posts, isLoading, error, search, refresh } = usePostList();
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  // API는 태그 하나만 검색한다. 제목/주제 태그 검색 결과 안에서 말머리를 교집합으로 적용한다.
  const visiblePosts = posts.filter((post) => !category || getPostCategory(post.hashtags) === category);
  /** 입력 중에는 요청하지 않고 검색 제출 시 두 조건을 함께 Hook에 전달한다. */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search({ title, tag });
  };

  return <section className="post-board">
    <header className="board-heading"><h2>컴퓨터공학과 게시판</h2><p>궁금한 코드부터 오늘의 점심 약속까지.</p></header>
    <div className="board-controls">
      <div className="board-categories" role="group" aria-label="말머리 필터">
        <button type="button" aria-pressed={!category} onClick={() => onCategoryChange?.('')}>전체</button>
        {POST_CATEGORIES.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => onCategoryChange?.(item)}>{item}</button>)}
      </div>
      {onCreate && <button type="button" className="board-write" onClick={onCreate}>글쓰기</button>}
    </div>
    <form onSubmit={handleSearch} className="board-search">
      <input type="search" aria-label="제목 검색" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목 검색" />
      <input type="search" aria-label="주제 태그 검색" value={tag} onChange={(event) => setTag(event.target.value.replace(/^#/, ''))} placeholder="주제 태그 (예: React)" />
      <button type="submit" disabled={isLoading}>검색</button>
    </form>
    {isLoading && <p role="status">게시글 목록을 불러오는 중입니다...</p>}
    {error && <div className="post-error" role="alert">{error} <button type="button" onClick={() => void refresh()}>다시 시도</button></div>}
    {!isLoading && !error && visiblePosts.length === 0 && <p className="post-help">조건에 맞는 게시글이 없습니다.</p>}
    {!isLoading && !error && visiblePosts.length > 0 && <table className="board-table">
      <caption className="post-help">{category || '전체'} 게시글 {visiblePosts.length}개</caption>
      <thead><tr><th scope="col">말머리</th><th scope="col">제목</th><th scope="col" className="board-desktop">작성일</th><th scope="col" className="board-desktop">조회</th><th scope="col" className="board-desktop">좋아요</th></tr></thead>
      <tbody>{visiblePosts.map((post) => <tr key={post.id}>
        <td><span className="post-category-badge">{getPostCategory(post.hashtags)}</span></td>
        <td className="board-title-cell">
          <button type="button" className="board-title-button" onClick={() => onPostClick?.(post.id)}>{post.title}</button>
          <span className="board-comment-count" aria-label={`댓글 ${post.comment_count}개`}>[{post.comment_count}]</span>
          <div className="board-row-meta">{post.author_username || post.author_account_id}{post.image_urls.length > 0 && ` · 첨부 이미지 ${post.image_urls.length}개`}</div>
        </td>
        <td className="board-desktop">{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
        <td className="board-desktop">{post.view_count}</td><td className="board-desktop">{post.like_count}</td>
      </tr>)}</tbody>
    </table>}
  </section>;
};
