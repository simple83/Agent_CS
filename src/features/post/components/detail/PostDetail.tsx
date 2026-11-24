import { useCallback, useState } from 'react';
import { usePostDetail } from '../../hooks/usePostDetail';
import { CommentSection } from '../../../comment/components/CommentSection';
import { MarkdownContent } from '../../../../shared/components/richText/MarkdownContent';
import { PostLikeControl } from './PostLikeControl';
import { PostOwnerActions } from './PostOwnerActions';
import { useAuthUserId } from '../../../auth/hooks/useAuthSession';
import { getPostCategory } from '../../utils/postEditor';
import styles from './PostDetail.module.css';
import ui from '../../../../shared/styles/Controls.module.css';

interface PostDetailProps {
  postId: number;
  /** 화면 이동은 Page에 위임한다. 콜백 없는 읽기 전용 상세에는 관리 도구를 표시하지 않는다. */
  onEdit?: () => void;
  onDeleted?: () => void | Promise<void>;
}

/** 상세 조회 상태를 먼저 분기한 뒤 본문과 태그를 표시한다. 좋아요 변경 도구는 이 상세 화면에만 둔다. */
export const PostDetail = ({ postId, onEdit, onDeleted }: PostDetailProps) => {
  const userId = useAuthUserId();
  const [commentCount, setCommentCount] = useState<{ postId: number; count: number } | null>(null);
  // 댓글 목록만 조회해 받은 집계를 표시한다. 게시글 재조회로 조회수를 증가시키지 않는다.
  const updateCommentCount = useCallback((count: number) => setCommentCount({ postId, count }), [postId]);
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
    <article className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headingRow}>
          <span className={ui.badge}>{getPostCategory(post.hashtags)}</span>
          {/* 계정 전환 때 관리 상태도 초기화한다. 실제 권한은 서버가 최종 검증한다. */}
          {userId === post.author_id && onEdit && onDeleted && <PostOwnerActions
            key={`${post.id}:${userId}`} postId={post.id} authorId={post.author_id}
            onEdit={onEdit} onDeleted={onDeleted} />}
        </div>
        <h1 className={styles.title}>{post.title}</h1>

        <div className={styles.author}>
          {/* 닉네임 미설정 계정도 목록과 동일하게 계정 ID로 작성자를 식별한다. */}
          <span>{post.author_username || post.author_account_id}</span>
          <span>@{post.author_account_id}</span>
        </div>

        <div className={styles.meta}>
          <span>조회 {post.view_count}</span>
          <span>댓글 {commentCount?.postId === postId ? commentCount.count : post.comment_count}</span>
        </div>
      </header>

      <MarkdownContent content={post.content} allowImages />

      {post.hashtags.length > 0 && (
        <div className={styles.hashtags}>
          {post.hashtags.map((hashtag) => (
            <span
              key={hashtag.id}
              className={styles.hashtag}
            >
              #{hashtag.name}
            </span>
          ))}
        </div>
      )}
      {/* 글 이동 또는 새 상세 합계를 받으면 해당 글의 좋아요 상태를 다시 확인한다. */}
      <PostLikeControl key={`${post.id}:${post.like_count}`} postId={post.id} initialCount={post.like_count} />
      <CommentSection postId={post.id} postAuthorId={post.author_id} onCountChange={updateCommentCount} />
    </article>
  );
};
