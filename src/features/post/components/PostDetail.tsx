import { usePostDetail } from '../hooks/usePostDetail';

interface PostDetailProps {
  postId: number;
}

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
        <h1>{post.title}</h1>

        <div style={styles.author}>
          <span>{post.author_username}</span>
          <span>@{post.author_account_id}</span>
        </div>

        <div style={styles.meta}>
          <span>조회 {post.view_count}</span>
          <span>좋아요 {post.like_count}</span>
          <span>댓글 {post.comment_count}</span>
        </div>
      </header>

      {post.image_urls.length > 0 && (
        <div style={styles.images}>
          {post.image_urls.map((imageUrl) => (
            <img
              key={imageUrl}
              src={imageUrl}
              alt={post.title}
              style={styles.image}
            />
          ))}
        </div>
      )}

      <div style={styles.content}>
        {post.content}
      </div>

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
    </article>
  );
};

const styles = {
  container: {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
    boxSizing: 'border-box' as const,
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