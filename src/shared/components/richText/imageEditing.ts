import type { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';
import { canSplit } from '@tiptap/pm/transform';
import { closeHistory } from '@tiptap/pm/history';

/** 파일 선택창이 열린 동안 본문이 바뀌면 엉뚱한 이미지를 교체하지 않도록 원본 문서를 보관한다. */
export interface ImageReplacementTarget {
  position: number;
  src: string;
  document: Node;
}

/** 텍스트 옆 커서가 아니라 이미지 자체를 선택했을 때만 편집 도구를 제공한다. */
export const selectedImage = (editor: Editor) => {
  const selection = editor.state.selection;
  return selection instanceof NodeSelection && selection.node.type.name === 'image'
    ? { position: selection.from, src: String(selection.node.attrs.src), alt: String(selection.node.attrs.alt ?? '') }
    : null;
};

/** 선택 당시 문서와 이미지가 그대로인지 검사한다. 읽기 전용 상태에서는 파일 교체를 거부한다. */
export const canReplaceImage = (editor: Editor, target: ImageReplacementTarget): boolean => {
  const node = editor.state.doc.nodeAt(target.position);
  return editor.isEditable && editor.state.doc.eq(target.document)
    && node?.type.name === 'image' && node.attrs.src === target.src;
};

/** 이미지 한 개만 교체하며 양쪽 텍스트와 다른 이미지는 유지한다. 한 번의 실행 취소로 복구한다. */
export const replaceImage = (editor: Editor, target: ImageReplacementTarget, attrs: { src: string; alt: string }): boolean => {
  if (!canReplaceImage(editor, target)) return false;
  return editor.chain().command(({ tr }) => { closeHistory(tr); return true; }).setNodeSelection(target.position)
    .insertContent({ type: 'image', attrs }).setNodeSelection(target.position).run();
};

/** 이미지 바로 뒤에서 문단을 나누므로 뒤에 이미 있던 텍스트도 다음 문단에 보존한다. */
export const addParagraphAfterImage = (editor: Editor): boolean => {
  const image = selectedImage(editor);
  if (!editor.isEditable || !image) return false;
  const position = image.position + 1;
  const paragraph = editor.schema.nodes.paragraph;
  if (!canSplit(editor.state.doc, position, 1, [{ type: paragraph }])) return false;

  // 문단 분리와 커서 이동을 하나의 트랜잭션으로 처리한다.
  // 연속된 고수준 명령이 이미 바뀐 위치를 다시 매핑하지 않도록 새 문서 위치를 직접 계산한다.
  return editor.commands.command(({ tr, dispatch }) => {
    if (!dispatch) return true;
    closeHistory(tr);
    tr.split(position, 1, [{ type: paragraph }]);
    tr.setSelection(TextSelection.create(tr.doc, position + 2));
    tr.setStoredMarks([]);
    tr.scrollIntoView();
    return true;
  });
};

/** 선택한 이미지 노드만 제거한다. 서버 이미지 삭제 여부는 저장 시 본문 참조로 결정한다. */
export const deleteSelectedImage = (editor: Editor): boolean => {
  if (!editor.isEditable || !selectedImage(editor)) return false;
  return editor.commands.command(({ tr, dispatch }) => {
    if (dispatch) { closeHistory(tr); tr.deleteSelection().scrollIntoView(); }
    return true;
  });
};
