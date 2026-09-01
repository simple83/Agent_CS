import type { MouseEvent } from 'react';
import type { PostEntity } from '../types/post.types';

interface PostCardProps {
  post: PostEntity;
  onClick?: (postId: number) => void;
  onLike?: (postId: number, event: MouseEvent<HTMLButtonElement>) => void;
}

export const PostCard = ({ post, onClick, onLike }: PostCardProps) => {
  const HashtagGroup = () => {
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

  const AuthorMeta = () => (
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

  const StatsGroup = () => (
    <div style={styles.statsContainer}>
      <span>👀 {post.view_count}</span>
      {onLike ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onLike(post.id, event);
          }}
          style={styles.likeButton}
        >
          👍 {post.like_count}
        </button>
      ) : (
        <span>👍 {post.like_count}</span>
      )}
      <span>💬 {post.comment_count}</span>
    </div>
  );

  const ThumbnailImage = () => {
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

  return (
    <article onClick={() => onClick?.(post.id)} style={styles.cardContainer}>
      <div style={styles.cardHeader}>
        <HashtagGroup />
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
  likeButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#868e96',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
