import { createContext } from 'react';

// 코드블록은 EditorContent의 React 포털로 렌더링된다. 부모의 저장 중 상태를 공유하여
// 문서 내용이나 실행 취소 이력을 바꾸지 않고 블록 안의 언어 선택도 잠근다.
export const PostEditorDisabledContext = createContext(false);
