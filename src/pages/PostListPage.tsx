import { useNavigate, useSearchParams } from 'react-router';
import { PostList } from '../features/post/components/PostList';
import { isPostCategory } from '../features/post/utils/postEditor';

/**
 * 말머리를 URL 쿼리로 관리해 새로고침/뒤로 가기 후에도 선택을 복원한다.
 * 허용하지 않는 말머리는 전체로 표시하고, 글쓰기에는 현재 선택한 말머리를 전달한다.
 */
export const PostListPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const value = params.get('category') ?? '';
  const category = isPostCategory(value) ? value : '';

  return <PostList category={category} onCategoryChange={(next) => {
    setParams((previous) => {
      // 기존 쿼리 객체를 직접 변경하지 않고 말머리만 교체해 다른 쿼리도 보존한다.
      const updated = new URLSearchParams(previous);
      if (next) updated.set('category', next);
      else updated.delete('category');
      return updated;
    });
  }} onCreate={() => navigate(category ? `/posts/create?${new URLSearchParams({ category })}` : '/posts/create')}
    onPostClick={(postId) => navigate(`/posts/${postId}`)} />;
};
