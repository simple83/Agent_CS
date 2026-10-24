import { usePostDetail } from '../hooks/usePostDetail';
import { PostContent } from './PostContent';
import { PostLikeControl } from './PostLikeControl';
import { getPostCategory } from '../utils/postEditor';
import './PostBoard.css';

interface PostDetailProps {
  postId: number;
}

/** 상세 조회 상태를 먼저 분기한 뒤 본문과 태그를 표시한다. 좋아요 변경 도구는 이 상세 화면에만 둔다. */
export const PostDetail = ({ postId }: PostDetailProps) => {
  const {
    post,
    isLoading,
    error,
  } = usePostDetail(postId);

  if (isLoading) {
    return <div>게시글을 불러오는 중입니다...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!post) {
    return <div>게시글이 없습니다.</div>;
  }

  return (
    <article style={styles.container}>
      <header style={styles.header}>
        <span className="post-category-badge">{getPostCategory(post.hashtags)}</span>
        <h1 style={styles.title}>{post.title}</h1>

        <div style={styles.author}>
          <span>{post.author_username}</span>
          <span>@{post.author_account_id}</span>
        </div>

        <div style={styles.meta}>
          <span>조회 {post.view_count}</span>
          <span>댓글 {post.comment_count}</span>
        </div>
      </header>

      {/* 첨부는 본문 위에 모아 표시한다. 같은 URL이 반복되어도 키가 겹치지 않도록 순서를 함께 쓴다. */}
      {post.image_urls.length > 0 && (
        <div style={styles.images}>
          {post.image_urls.map((imageUrl, index) => (
            <img
              key={`${index}-${imageUrl}`}
              src={imageUrl}
              alt={post.title}
              style={styles.image}
            />
          ))}
        </div>
      )}

      <PostContent content={post.content} /> 

      {post.hashtags.length > 0 && (
        <div style={styles.hashtags}>
          {post.hashtags.map((hashtag) => (
            <span
              key={hashtag.id}
              style={styles.hashtag}
            >
              #{hashtag.name}
            </span>
          ))}
        </div>
      )}
      {/* 글 이동 또는 새 상세 합계를 받으면 해당 글의 좋아요 상태를 다시 확인한다. */}
      <PostLikeControl key={`${post.id}:${post.like_count}`} postId={post.id} initialCount={post.like_count} />
    </article>
  );
};

const styles = {
  container: {
    textAlign: 'left' as const,
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
    boxSizing: 'border-box' as const,
  },

  // 전역 h1의 큰 글자 크기에 고정 줄 높이가 상속되지 않도록 단위 없는 줄 높이를 지정한다.
  title: {
    margin: '0 0 16px',
    fontSize: 'clamp(24px, 4vw, 36px)',
    lineHeight: 1.4,
    letterSpacing: 'normal',
    overflowWrap: 'anywhere' as const,
  },

  header: {
    borderBottom: '1px solid #dee2e6',
    paddingBottom: '16px',
  },

  author: {
    display: 'flex',
    gap: '8px',
    color: '#495057',
  },

  meta: {
    display: 'flex',
    gap: '16px',
    marginTop: '10px',
    color: '#868e96',
    fontSize: '14px',
  },

  images: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginTop: '24px',
  },

  image: {
    width: '100%',
    borderRadius: '8px',
  },

  content: {
    marginTop: '24px',
    whiteSpace: 'pre-wrap' as const,
    lineHeight: '1.7',
  },

  hashtags: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
    marginTop: '24px',
  },

  hashtag: {
    color: '#4c6ef5',
    backgroundColor: '#edf2ff',
    padding: '5px 8px',
    borderRadius: '6px',
  },
};
