import type { PostEntity } from '../types/post.types';

interface PostCardProps {
  post: PostEntity;
  onClick?: (postId: number) => void;
}

/* 카드 높이가 과도하게 늘지 않도록 앞의 태그 세 개만 표시한다. 태그가 없으면 공간도 만들지 않는다. */
const HashtagGroup = ({ post }: { post: PostEntity }) => {
  if (post.hashtags.length === 0) return null;

  return (
    <div style={styles.hashtagContainer}>
      {post.hashtags.slice(0, 3).map((hashtag) => (
        <span key={hashtag.id} style={styles.badge}>
          #{hashtag.name}
        </span>
      ))}
    </div>
  );
};

/* 표시 이름이 없으면 계정 ID를 대신 쓰고, 작성일은 브라우저의 지역 설정으로 표시한다. */
const AuthorMeta = ({ post }: { post: PostEntity }) => (
  <div style={styles.authorContainer}>

    <span style={styles.authorName}>
      {post.author_username || post.author_account_id}
    </span>

    <span style={styles.accountId}>@{post.author_account_id}</span>

    <span style={styles.createdAt}>
      {new Date(post.created_at).toLocaleDateString()}
    </span>

  </div>
);


/*
 * 미리보기에서는 조회/좋아요/댓글 개수만 표시한다.
 * 좋아요 등록·취소는 상세 화면에서만 제공하므로 버튼이나 변경 콜백을 받지 않는다.
 */
const StatsGroup = ({ post }: Pick<PostCardProps, 'post'>) => (
  <div style={styles.statsContainer}>
    <span>👀 {post.view_count}</span>
    <span>👍 {post.like_count}</span>
    <span>💬 {post.comment_count}</span>
  </div>
);


/* 첫 이미지를 썸네일로 사용하고 나머지 이미지 수를 표시한다. 첨부가 없으면 렌더링하지 않는다. */
const ThumbnailImage = ({ post }: { post: PostEntity }) => {
  if (post.image_urls.length === 0) return null;

  return (
    <div style={styles.imageWrapper}>
      <img
        src={post.image_urls[0]}
        alt={post.title}
        style={styles.thumbnail}
      />
      {post.image_urls.length > 1 && (
        <span style={styles.imageCountBadge}>
          +{post.image_urls.length - 1}
        </span>
      )}
    </div>
  );
};

/*
 * 게시글을 요약하는 재사용 카드. 현재 표 형태의 PostList에서는 사용하지 않지만 향후 피드용으로 남겨둔다.
 * 이동 콜백이 있으면 키보드 Enter도 지원한다. 자식 컴포넌트는 모듈 범위에 두어 재마운트를 피한다.
 */
export const PostCard = ({ post, onClick }: PostCardProps) => {
  return (
    <article
      className="post-card"
      onClick={() => onClick?.(post.id)}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${post.title} 상세 보기` : undefined}
      onKeyDown={(event) => {
        // 카드 자체에 포커스된 Enter만 상세 이동으로 처리한다.
        if (event.target === event.currentTarget && event.key === 'Enter') {
          onClick?.(post.id);
        }
      }}
      style={styles.cardContainer}
    >
      <div style={styles.cardHeader}>
        <HashtagGroup post={post} />
        <AuthorMeta post={post} />
      </div>

      <div style={styles.cardBody}>
        <div style={styles.textContent}>
          <h3 style={styles.title}>{post.title}</h3>
          <p style={styles.content}>{post.content}</p>
        </div>
        <ThumbnailImage post={post} />
      </div>

      <div style={styles.cardFooter}>
        <StatsGroup post={post} />
      </div>
    </article>
  );
};

// 카드 배치와 두 줄 본문 요약 스타일. 상세 본문의 Markdown 렌더링과 별도로 적용한다.
const styles = {
  cardContainer: {
    border: '1px solid #dee2e6',
    borderRadius: '12px',
    padding: '20px',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  hashtagContainer: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#868e96',
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-end',
  },
  authorName: {
    fontWeight: 'bold' as const,
    color: '#495057',
  },
  accountId: {
    color: '#868e96',
  },
  createdAt: {
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
    minWidth: 0,
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
};
