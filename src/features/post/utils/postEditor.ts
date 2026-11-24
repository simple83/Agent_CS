import type { Hashtag } from '../types/post.types';

/**
 * boardTag는 화면의 말머리이며 API의 별도 필드가 아니다. 아래 이름을 대표 해시태그로 예약한다.
 * 저장은 hashtags 배열, 조회는 tag 쿼리로 처리한다.
 * 이 순서는 선택 메뉴의 표시 순서이면서 기존 글에 여러 후보가 있을 때의 우선순위다.
 * 이름을 변경하면 이미 저장한 글의 분류에도 영향을 주므로 임의로 바꾸지 않는다.
 */
export const POST_BOARD_TAGS = ['자유', '질문', '코드리뷰', '정보공유', '모집', '밥친구'] as const;
export type PostBoardTag = typeof POST_BOARD_TAGS[number];

/** URL 또는 select에서 받은 문자열을 검사하고 TypeScript의 말머리 타입으로 좁힌다. */
export const isPostBoardTag = (value: string): value is PostBoardTag =>
  POST_BOARD_TAGS.some((boardTag) => boardTag === value);

/**
 * 응답의 해시태그에서 목록/상세에 표시할 말머리 하나를 결정한다.
 * 과거 글의 태그 순서가 달라도 같은 결과가 나오도록 POST_BOARD_TAGS 순서로 찾는다.
 * 구체적인 말머리가 없으면 자유로 표시하며, DB에 태그를 새로 쓰거나 수정하지 않는다.
 */
export const getPostBoardTag = (tags: Hashtag[]): PostBoardTag =>
  POST_BOARD_TAGS.find((boardTag) =>
    boardTag !== '자유' && tags.some((tag) => tag.name === boardTag),
  ) ?? '자유';

/**
 * 선택한 말머리와 쉼표로 입력한 주제를 기존 API의 hashtags 배열로 합친다.
 * 공백/선행 #/빈 항목/정확히 같은 중복 태그를 제거한다(영문 대소문자는 보존).
 * 자유 입력에 들어온 말머리 이름은 제외하여 새 글에는 대표 말머리 하나만 저장한다.
 */
export const getPostTags = (boardTag: PostBoardTag, input: string): string[] => [
  boardTag,
  ...new Set(input.split(',')
    .map((tag) => tag.trim().replace(/^#+/, '').trim())
    .filter((tag) => tag && !isPostBoardTag(tag))),
];

/** 수정 폼에는 대표 말머리 이외의 기존 태그를 모두 표시해 과거 태그도 직접 확인하게 한다. */
export const getPostTopicInput = (tags: Hashtag[]): string =>
  tags.filter((tag) => tag.name !== getPostBoardTag(tags)).map((tag) => tag.name).join(', ');

/**
 * 수정하지 않은 태그는 순서·공백·옛 말머리를 보존하되, 쉼표가 섞인 과거 태그는 분리한다.
 * 주제 입력을 바꾼 경우에만 쉼표 규칙으로 해석하며, 기존의 다른 말머리 태그도 보존한다.
 * 단, 말머리를 명시적으로 바꾸면 예약 태그들을 선택한 하나로 정리한다. 그렇지 않으면
 * 과거 말머리의 표시 우선순위 때문에 저장 후 사용자의 새 선택이 무시될 수 있다.
 */
export const getEditedPostTags = (tags: Hashtag[], boardTag: PostBoardTag, input: string): string[] => {
  const originalBoardTag = getPostBoardTag(tags);
  const originalNames = tags.map((tag) => tag.name);
  const unchangedInput = input === getPostTopicInput(tags);
  // 과거에 "python,fastapi"가 단일 태그로 저장되었다면 편집 후 저장할 때 두 태그로 복구한다.
  // 화면을 읽는 것만으로 서버 데이터를 바꾸지 않으며 쉼표 없는 태그는 원래대로 유지한다.
  const separatedNames = [...new Set(originalNames.flatMap((name) => name.includes(',')
    ? name.split(',').map((part) => part.trim().replace(/^#+/, '').trim()).filter(Boolean) : [name]))];
  if (unchangedInput && boardTag === originalBoardTag) return separatedNames;

  const topics = unchangedInput ? separatedNames.filter((name) => name !== originalBoardTag)
    : input.split(',').map((tag) => tag.trim().replace(/^#+/, '').trim()).filter(Boolean);
  const preservedTopics = topics.filter((name) => !isPostBoardTag(name)
    || (boardTag === originalBoardTag && originalNames.includes(name)));
  return [...new Set([boardTag, ...preservedTopics])];
};

// 게시글에서 사용하던 편집 보조 함수의 공개 경로를 유지한다. 구현은 댓글과 공유한다.
export { CODE_LANGUAGES, codeFence, inlineCode, insertBlock } from '../../../shared/components/richText/codeFormatting';
