import styles from './PostCard.module.css';
import type { PostEntity } from '../../types/post.types';

interface PostCardProps {
  post: PostEntity;
  onClick?: (postId: number) => void;
}

/* 카드 높이가 과도하게 늘지 않도록 앞의 태그 세 개만 표시한다. 태그가 없으면 공간도 만들지 않는다. */
const HashtagGroup = ({ post }: { post: PostEntity }) => {
  if (post.hashtags.length === 0) return null;

  return (
    <div className={styles.hashtagContainer}>
      {post.hashtags.slice(0, 3).map((hashtag) => (
        <span key={hashtag.id} className={styles.badge}>
          #{hashtag.name}
        </span>
      ))}
    </div>
  );
};

/* 표시 이름이 없으면 계정 ID를 대신 쓰고, 작성일은 브라우저의 지역 설정으로 표시한다. */
const AuthorMeta = ({ post }: { post: PostEntity }) => (
  <div className={styles.authorContainer}>

    <span className={styles.authorName}>
      {post.author_username || post.author_account_id}
    </span>

    <span className={styles.accountId}>@{post.author_account_id}</span>

    <span className={styles.createdAt}>
      {new Date(post.created_at).toLocaleDateString()}
    </span>

  </div>
);


/*
 * 미리보기에서는 조회/좋아요/댓글 개수만 표시한다.
 * 좋아요 등록·취소는 상세 화면에서만 제공하므로 버튼이나 변경 콜백을 받지 않는다.
 */
const StatsGroup = ({ post }: Pick<PostCardProps, 'post'>) => (
  <div className={styles.statsContainer}>
    <span>👀 {post.view_count}</span>
    <span>👍 {post.like_count}</span>
    <span>💬 {post.comment_count}</span>
  </div>
);


/* 첫 이미지를 썸네일로 사용하고 나머지 이미지 수를 표시한다. 첨부가 없으면 렌더링하지 않는다. */
const ThumbnailImage = ({ post }: { post: PostEntity }) => {
  if (post.image_urls.length === 0) return null;

  return (
    <div className={styles.imageWrapper}>
      <img
        src={post.image_urls[0]}
        alt={post.title}
        className={styles.thumbnail}
      />
      {post.image_urls.length > 1 && (
        <span className={styles.imageCountBadge}>
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
      className={styles.cardContainer}
    >
      <div className={styles.cardHeader}>
        <HashtagGroup post={post} />
        <AuthorMeta post={post} />
      </div>

      <div className={styles.cardBody}>
        <div className={styles.textContent}>
          <h3 className={styles.title}>{post.title}</h3>
          <p className={styles.content}>{post.content}</p>
        </div>
        <ThumbnailImage post={post} />
      </div>

      <div className={styles.cardFooter}>
        <StatsGroup post={post} />
      </div>
    </article>
  );
};
