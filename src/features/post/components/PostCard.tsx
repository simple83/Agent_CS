import type { PostEntity } from '../types/post.type';

interface PostCardProps {
  post: PostEntity;
  onClick?: (postId: number) => void;
  onLike?: (postId: number, e: React.MouseEvent) => void;
}

export const PostCard = ({ post, onClick, onLike }: PostCardProps) => {
  //카테고리 뱃지
  const CategoryBadge = () => (
    <span style={styles.badge}>{post.category}</span>
  );

  //작성자 및 생성일자
  const AuthorMeta = () => (
    <div style={styles.authorContainer}>
      by <span style={styles.authorName}>{post.account_id}</span>
      <span style={styles.createdAt}>{new Date(post.created_at).toLocaleDateString()}</span>
    </div>
  );

  // 조회수, 좋아요, 댓글수
  const StatsGroup = () => (
    <div style={styles.statsContainer}>
      <span>👀 {post.view_count}</span>
      <button 
        onClick={(e) => {
          e.stopPropagation(); // 카드 클릭 이벤트와 겹치지 않게 방지
          onLike?.(post.post_id, e);
        }}
        style={styles.likeButton}
      >
        👍 {post.like_count}
      </button>
      <span>💬 {post.comment_count}</span>
    </div>
  );

  //대표 이미지 미리보기 (이미지 URL 배열이 있을 때)
  const ThumbnailImage = () => {
    if (!post.image_urls || post.image_urls.length === 0) return null;
    return (
      <div style={styles.imageWrapper}>
        <img 
          src={post.image_urls[0]} 
          alt={post.title} 
          style={styles.thumbnail} 
        />
        {post.image_urls.length > 1 && (
          <span style={styles.imageCountBadge}>+{post.image_urls.length - 1}</span>
        )}
      </div>
    );
  };

  return (
    <article 
      onClick={() => onClick?.(post.post_id)} 
      style={styles.cardContainer}
    >
      <div style={styles.cardHeader}>
        <CategoryBadge />
        <AuthorMeta />
      </div>

      <div style={styles.cardBody}>
        <div style={styles.textContent}>
          <h3 style={styles.title}>{post.title}</h3>
          <p style={styles.content}>{post.content}</p>
        </div>
        <ThumbnailImage />
      </div>

      <div style={styles.cardFooter}>
        <StatsGroup />
      </div>
    </article>
  );
};


const styles = {
  cardContainer: {
    border: '1px solid #dee2e6',
    borderRadius: '12px',
    padding: '20px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    fontSize: '11px',
    fontWeight: 'bold' as const,
    color: '#4c6ef5',
    backgroundColor: '#edf2ff',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  authorContainer: {
    fontSize: '13px',
    color: '#868e96',
  },
  authorName: {
    fontWeight: 'bold' as const,
    color: '#495057',
  },
  createdAt: {
    marginLeft: '8px',
    fontSize: '12px',
    color: '#adb5bd',
  },
  cardBody: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
  },
  textContent: {
    flex: 1,
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '18px',
    color: '#212529',
    lineHeight: '1.4',
  },
  content: {
    margin: 0,
    fontSize: '14px',
    color: '#495057',
    lineHeight: '1.6',
    // 2줄 이상은 말줄임표(...) 처리
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'relative' as const,
    width: '80px',
    height: '80px',
    flexShrink: 0,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    borderRadius: '8px',
  },
  imageCountBadge: {
    position: 'absolute' as const,
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#ffffff',
    fontSize: '10px',
    padding: '2px 4px',
    borderRadius: '4px',
  },
  cardFooter: {
    borderTop: '1px solid #f1f3f5',
    paddingTop: '12px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  statsContainer: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: '#868e96',
    alignItems: 'center',
  },
  likeButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#868e96',
    cursor: 'pointer',
    fontSize: '13px',
  },
};