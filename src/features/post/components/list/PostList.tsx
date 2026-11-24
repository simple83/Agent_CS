import { useState, type FormEvent } from 'react';
import { usePostList } from '../../hooks/usePostList';
import { POST_BOARD_TAGS, getPostBoardTag, type PostBoardTag } from '../../utils/postEditor';
import styles from './PostList.module.css';
import layout from '../../styles/PostLayout.module.css';
import ui from '../../../../shared/styles/Controls.module.css';

interface PostListProps {
  onPostClick?: (postId: number) => void;
  boardTag?: PostBoardTag | '';
  initialTopicTag?: string;
  onBoardTagChange?: (boardTag: PostBoardTag | '') => void;
  onCreate?: () => void;
}

/**
 * 말머리 필터·검색·표 목록을 표시한다. URL 변경과 화면 이동은 Page에서 전달한 콜백으로 처리한다.
 * 서버 페이지를 순서대로 가져오며 말머리와 주제 태그를 교차 필터링한다. 전체 개수는 추측하지 않는다.
 */
const PostListView = ({ onPostClick, boardTag = '', initialTopicTag = '', onBoardTagChange, onCreate }: PostListProps) => {
  const { posts, hasMore, loadMore, isLoading, error, search, refresh } = usePostList({ tag: initialTopicTag || undefined }, boardTag);
  const [title, setTitle] = useState('');
  const [sort, setSort] = useState<'created_at' | 'view_count'>('created_at');
  const [tag, setTag] = useState(initialTopicTag);
  // API는 태그 하나만 검색한다. 제목/주제 태그 검색 결과 안에서 말머리를 교집합으로 적용한다.
  const visiblePosts = posts.filter((post) => !boardTag || getPostBoardTag(post.hashtags) === boardTag);
  /** 입력 중에는 요청하지 않고 검색 제출 시 두 조건을 함께 Hook에 전달한다. */
  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search({ title, tag, sort });
  };

  return <section className={layout.page}>
    <header className={`${layout.heading} ${styles.heading}`}><h2>컴퓨터공학과 게시판</h2><p>궁금한 코드부터 오늘의 점심 약속까지.</p></header>
    <div className={styles.controls}>
      <div className={styles.categories} role="group" aria-label="말머리 필터">
        <button className={ui.button} type="button" aria-pressed={!boardTag} onClick={() => onBoardTagChange?.('')}>전체</button>
        {POST_BOARD_TAGS.map((item) => <button className={ui.button} type="button" key={item} aria-pressed={boardTag === item} onClick={() => onBoardTagChange?.(item)}>{item}</button>)}
      </div>
      {onCreate && <button type="button" className={`${ui.button} ${ui.primary} ${styles.write}`} onClick={onCreate}>글쓰기</button>}
    </div>
    <form onSubmit={handleSearch} className={styles.search}>
      <input className={ui.input} type="search" aria-label="제목 검색" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목 검색" />
      <input className={ui.input} type="search" aria-label="주제 태그 검색" value={tag} onChange={(event) => setTag(event.target.value.replace(/^#/, ''))} placeholder="주제 태그 (예: React)" />
      <select className={ui.input} aria-label="게시글 정렬" value={sort} onChange={(event) => setSort(event.target.value as 'created_at' | 'view_count')}>
        <option value="created_at">최신순</option><option value="view_count">조회순</option>
      </select>
      <button className={ui.button} type="submit" disabled={isLoading}>검색</button>
    </form>
    {isLoading && <p role="status">게시글 목록을 불러오는 중입니다...</p>}
    {error && <div className={ui.error} role="alert">{error} <button className={ui.button} type="button" onClick={() => void refresh()}>다시 시도</button></div>}
    {!isLoading && !error && visiblePosts.length === 0 && <p className={ui.help}>{hasMore ? '불러온 범위에 조건에 맞는 글이 없습니다. 더 불러오기로 다음 게시글을 확인하세요.' : '조건에 맞는 게시글이 없습니다.'}</p>}
    {!isLoading && !error && visiblePosts.length > 0 && <table className={styles.table}>
      <caption className={ui.help}>불러온 {boardTag || '전체'} 게시글 {visiblePosts.length}개</caption>
      <thead><tr><th scope="col">말머리</th><th scope="col">제목</th><th scope="col" className={styles.desktop}>작성일</th><th scope="col" className={styles.desktop}>조회</th><th scope="col" className={styles.desktop}>좋아요</th></tr></thead>
      <tbody>{visiblePosts.map((post) => <tr key={post.id}>
        <td><span className={ui.badge}>{getPostBoardTag(post.hashtags)}</span></td>
        <td className={styles.titleCell}>
          <button type="button" className={styles.titleButton} onClick={() => onPostClick?.(post.id)}>{post.title}</button>
          <span className={styles.commentCount} aria-label={`댓글 ${post.comment_count}개`}>[{post.comment_count}]</span>
          <div className={styles.rowMeta}>{post.author_username || post.author_account_id}</div>
        </td>
        <td className={styles.desktop}>{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
        <td className={styles.desktop}>{post.view_count}</td><td className={styles.desktop}>{post.like_count}</td>
      </tr>)}</tbody>
    </table>}
    {hasMore && <button className={ui.button} type="button" disabled={isLoading} onClick={() => void loadMore()}>더 불러오기</button>}
  </section>;
};

/** 말머리를 바꾸면 입력과 페이지 위치도 함께 초기화해 이전 검색 결과를 섞지 않는다. */
export const PostList = (props: PostListProps) => <PostListView key={`${props.boardTag ?? ''}:${props.initialTopicTag ?? ''}`} {...props} />;
