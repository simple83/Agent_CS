import { usePostList } from '../hooks/usePostList';
import { PostCard } from './PostCard';
import type { PostCategory } from '../types/post.type';

export const PostList = () => {
  const { posts, currentCategory, isLoading, error, changeCategory } = usePostList();

  // 게시글 클릭 시 이동 핸들러 예시
  const handlePostClick = (postId: number) => {
    console.log(`게시글 상세 페이지로 이동: ${postId}`);
  };

  // 헤더
  const RenderHeader = () => (
    <header style={styles.header}>
      <h2 style={styles.headerTitle}>📋 커뮤니티 게시판</h2>
      <p style={styles.headerSubtitle}>다양한 카테고리의 글을 확인해 보세요.</p>
    </header>
  );

  // 카테고리 탭
  const RenderCategoryTabs = () => {
    const categories: { label: string; value: PostCategory | undefined }[] = [
      { label: '전체', value: undefined },
      { label: '자유', value: 'FREE' },
      { label: '코드리뷰', value: 'CODE_REVIEW' },
      { label: '밥친구', value: 'MEAL_MATE' },
      { label: '강의정보', value: 'LECTURE_INFO' },
      { label: '취업', value: 'JOB' },
    ];

    return (
      <div style={styles.tabContainer}>
        {categories.map((cat) => {
          const isSelected = currentCategory === cat.value;
          return (
            <button
              key={cat.label}
              onClick={() => changeCategory(cat.value)}
              style={{
                ...styles.tabButton,
                backgroundColor: isSelected ? '#007bff' : '#f8f9fa',
                color: isSelected ? '#ffffff' : '#495057',
                border: isSelected ? '1px solid #007bff' : '1px solid #ced4da',
                fontWeight: isSelected ? 'bold' : 'normal',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    );
  };

  // 상태 메시지
  const RenderStatusMessage = () => {
    if (isLoading) return <div style={styles.loadingText}>🔄 게시글 목록을 불러오는 중입니다...</div>;
    if (error) return <div style={styles.errorBox}>⚠️ {error}</div>;
    if (posts.length === 0) return <div style={styles.emptyText}>등록된 게시글이 없습니다. 첫 글의 주인공이 되어보세요!</div>;
    return null;
  };



  return (
    <div style={styles.container}>
      <RenderHeader />
      <RenderCategoryTabs />
      <RenderStatusMessage />

      {/* 게시글 목록 피드 */}
      {!isLoading && (
        <div style={styles.feedContainer}>
          {posts.map((post) => (
            <PostCard 
              key={post.post_id} 
              post={post} 
              onClick={handlePostClick}
              />
          ))}
        </div>
      )}
    </div>
  );
};


// 스타일
const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'sans-serif',
  },
  header: {
    marginBottom: '30px',
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
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '25px',
    flexWrap: 'wrap' as const,
  },
  tabButton: {
    padding: '10px 18px',
    borderRadius: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  feedContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  card: {
    border: '1px solid #dee2e6',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
    backgroundColor: '#ffffff',
  },
  cardBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#4c6ef5',
    backgroundColor: '#edf2ff',
    padding: '4px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase' as const,
  },
  cardTitle: {
    margin: '12px 0 8px 0',
    color: '#212529',
    fontSize: '18px',
  },
  cardContent: {
    color: '#495057',
    margin: '0 0 15px 0',
    fontSize: '15px',
    lineHeight: '1.5',
  },
  cardMetaContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    color: '#868e96',
    borderTop: '1px solid #f1f3f5',
    paddingTop: '12px',
  },
  cardAuthor: {
    fontWeight: 'bold',
    color: '#495057',
  },
  cardStats: {
    display: 'flex',
    gap: '12px',
  },
  loadingText: {
    textAlign: 'center' as const,
    padding: '20px 0',
    color: '#007bff',
    fontWeight: 'bold',
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
    padding: '4px 0',
    color: '#868e96',
  },
};