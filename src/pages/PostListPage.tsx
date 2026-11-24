import { useNavigate, useSearchParams } from 'react-router';
import { PostList } from '../features/post/components/list/PostList';
import { isPostBoardTag } from '../features/post/utils/postEditor';

/**
 * 말머리를 URL 쿼리로 관리해 새로고침/뒤로 가기 후에도 선택을 복원한다.
 * 예약 말머리 이외의 tag는 일반 주제 검색으로 처리하고, 글쓰기에는 선택한 말머리를 전달한다.
 */
export const PostListPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // 외부 URL은 API와 같은 tag를 쓴다. 이전 북마크의 category는 읽기 전용 별칭이다.
  const value = params.get('tag') ?? params.get('category') ?? '';
  const boardTag = isPostBoardTag(value) ? value : '';
  const topicTag = params.has('tag') && !boardTag ? value.trim() : '';

  return <PostList boardTag={boardTag} initialTopicTag={topicTag} onBoardTagChange={(next) => {
    setParams((previous) => {
      // 기존 쿼리 객체를 직접 변경하지 않고 말머리만 교체해 다른 쿼리도 보존한다.
      const updated = new URLSearchParams(previous);
      updated.delete('category');
      if (next) updated.set('tag', next);
      else updated.delete('tag');
      return updated;
    });
  }} onCreate={() => navigate(boardTag ? `/posts/create?${new URLSearchParams({ tag: boardTag })}` : '/posts/create')}
    onPostClick={(postId) => navigate(`/posts/${postId}`)} />;
};
