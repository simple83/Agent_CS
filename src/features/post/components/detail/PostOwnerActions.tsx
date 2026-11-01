import { usePostDelete } from '../../hooks/usePostDelete';
import ui from '../../../../shared/styles/Controls.module.css';

interface PostOwnerActionsProps {
  postId: number;
  authorId: number;
  onEdit: () => void;
  onDeleted: () => void | Promise<void>;
}

/**
 * 작성자 전용 수정·삭제 도구다. 부모가 작성자일 때만 마운트한다.
 * 브라우저 기본 확인창을 사용해 키보드 확인/취소와 포커스 복귀를 브라우저에 맡긴다.
 * 확인 전에는 DELETE를 보내지 않으며, 요청 중에는 수정 이동과 재삭제를 모두 막는다.
 */
export const PostOwnerActions = ({ postId, authorId, onEdit, onDeleted }: PostOwnerActionsProps) => {
  const { deletePost, isDeleting, isDeleted, error } = usePostDelete(postId, authorId, onDeleted);
  const disabled = isDeleting || isDeleted;

  /** 확인창 취소는 아무 요청도 만들지 않는다. 실제 권한 확인과 중복 차단은 Hook에서 다시 한다. */
  const handleDelete = () => {
    if (disabled || !window.confirm('게시글을 삭제하시겠습니까? 삭제 후에는 이 화면에서 복원할 수 없습니다.')) return;
    void deletePost();
  };

  return <div>
    <div className={ui.actions} role="group" aria-label="내 게시글 관리">
      <button type="button" className={ui.button} disabled={disabled} onClick={onEdit}>수정</button>
      <button type="button" className={ui.button} disabled={disabled} onClick={handleDelete}>
        {isDeleting ? '삭제 중...' : isDeleted ? '삭제 완료' : '삭제'}
      </button>
    </div>
    {error && <p className={ui.error} role="alert">{error}</p>}
  </div>;
};
