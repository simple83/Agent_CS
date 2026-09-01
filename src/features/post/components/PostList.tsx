import { useState, type FormEvent } from 'react';
import { usePostList } from '../hooks/usePostList';
import { PostCard } from './PostCard';

interface PostListProps {
  onPostClick?: (postId: number) => void;
}

export const PostList = ({ onPostClick }: PostListProps) => {
  const { posts, isLoading, error, search } = usePostList();
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void search({ title, tag });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>📋 커뮤니티 게시판</h2>
        <p style={styles.headerSubtitle}>
          제목과 해시태그로 게시글을 검색할 수 있습니다.
        </p>
      </header>

      <form onSubmit={handleSearch} style={styles.searchForm}>
        <input
          type="search"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목 검색"
          style={styles.searchInput}
        />
        <input
          type="search"
          value={tag}
          onChange={(event) => setTag(event.target.value.replace(/^#/, ''))}
          placeholder="해시태그 검색 (예: React)"
          style={styles.searchInput}
        />
        <button type="submit" disabled={isLoading} style={styles.searchButton}>
          검색
        </button>
      </form>

      {isLoading && (
        <div style={styles.loadingText}>🔄 게시글 목록을 불러오는 중입니다...</div>
      )}
      {error && <div style={styles.errorBox}>⚠️ {error}</div>}
      {!isLoading && !error && posts.length === 0 && (
        <div style={styles.emptyText}>조건에 맞는 게시글이 없습니다.</div>
      )}

      {!isLoading && !error && posts.length > 0 && (
        <div style={styles.feedContainer}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onClick={onPostClick} />
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'sans-serif',
  },
  header: {
    marginBottom: '24px',
    borderBottom: '2px solid #333',
    paddingBottom: '10px',
  },
  headerTitle: {
    margin: 0,
    color: '#333',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: '14px',
    marginTop: '5px',
  },
  searchForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr auto',
    gap: '8px',
    marginBottom: '24px',
  },
  searchInput: {
    minWidth: 0,
    padding: '10px 12px',
    border: '1px solid #ced4da',
    borderRadius: '8px',
    fontSize: '14px',
  },
  searchButton: {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#007bff',
    color: '#fff',
    cursor: 'pointer',
  },
  feedContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  loadingText: {
    textAlign: 'center' as const,
    padding: '20px 0',
    color: '#007bff',
    fontWeight: 'bold' as const,
  },
  errorBox: {
    padding: '15px',
    backgroundColor: '#fff5f5',
    color: '#e03e3e',
    borderRadius: '6px',
    marginBottom: '20px',
    border: '1px solid #ffe3e3',
  },
  emptyText: {
    textAlign: 'center' as const,
    padding: '24px 0',
    color: '#868e96',
  },
};
