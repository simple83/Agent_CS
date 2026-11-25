import { imageReferences, mapMarkdownImages } from '../../../shared/components/richText/markdownImages';
import { normalizeTags, parsePostSummary, validatePostInput, validatePostQuery } from '../utils/postContract';
import type { PostApi } from '../types/postApi.types';
import type { Hashtag, PostEntity } from '../types/post.types';
import {
  readMockDatabase, requireMockUser, saveMockDatabase, waitForMockRequest,
} from '../../../shared/mocks/mockStore';
import type { MockDatabase } from '../../../shared/mocks/mockStore';
import { authStorage } from '../../../shared/services/authStorage';

/** 삭제되지 않은 글을 찾는다. 수정용 내부 객체를 반환하므로 외부 응답에는 복사본을 사용한다. */
const findPost = (data: MockDatabase, postId: number) => {
  const post = data.posts.find((item) => item.id === postId && !item.is_deleted);
  if (!post) throw new Error('존재하지 않는 게시글입니다.');
  return post;
};

/** 로그인 및 작성자 소유권을 함께 검사한다. 수정/삭제가 다른 사용자의 글에 적용되지 않게 한다. */
const findOwnedPost = (data: MockDatabase, postId: number) => {
  const user = requireMockUser(data);
  const post = findPost(data, postId);
  if (post.author_id !== user.id) throw new Error('본인이 작성한 게시글만 수정하거나 삭제할 수 있습니다.');
  return post;
};

/** 태그 이름의 공백과 대소문자·중복을 정리한다. 기존 이름의 ID는 재사용하고 새 이름에만 ID를 부여한다. */
const makeHashtags = (data: MockDatabase, names: string[]): Hashtag[] => {
  const known = new Map(data.posts.flatMap((post) => post.hashtags).map((tag) => [tag.name, tag]));
  let nextId = Math.max(0, ...[...known.values()].map((tag) => tag.id)) + 1;
  const unique = normalizeTags(names);
  return unique.map((name) => known.get(name) ?? { id: nextId++, name });
};

/**
 * 새로고침 후에도 보이도록 작은 시연 이미지를 data URL로 저장한다. 합계 1MB와 MIME을 검사한다.
 * 8192바이트씩 변환해 함수 인자 수 제한을 피한다. 실제 파일 내용 검사나 서버 업로드를 대체하지 않는다.
 */
const readImages = async (images: File[] = []): Promise<string[]> => {
  if (images.reduce((size, file) => size + file.size, 0) > 1024 * 1024) {
    throw new Error('Mock에서는 한 번에 합계 1MB 이하의 이미지를 사용해주세요.');
  }
  return Promise.all(images.map(async (file) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      throw new Error('Mock에서는 PNG, JPEG, GIF, WebP 이미지를 사용해주세요.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return `data:${file.type};base64,${btoa(binary)}`;
  }));
};

/** 요청 중 계정 전환을 감지한다. HTTP 요청이 시작 시점 토큰을 사용하는 것과 같은 경계를 둔다. */
const assertSession = (token: string | null) => {
  if (!token || authStorage.getAccessToken() !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 시도해주세요.');
};

/** 지연 도중 로그인 상태가 바뀌면 다른 계정으로 이전 요청을 실행하지 않는다. */
const waitForMutation = async () => {
  const token = authStorage.getAccessToken();
  await waitForMockRequest();
  assertSession(token);
  return token;
};

/** 실제 API와 같은 인터페이스로 로컬 DB를 조작한다. 지연/실패를 먼저 처리한 뒤 데이터를 변경한다. */
export const mockPostApi: PostApi = {
  /** 삭제 글을 제외하고 제목 부분 일치/태그 이름 일치를 교집합으로 적용한 뒤 최신순으로 반환한다. */
  async getPosts(params = {}) {
    validatePostQuery(params);
    const { title, tag, sort = 'created_at', limit = 20, offset = 0 } = params;
    await waitForMockRequest();
    const titleQuery = title?.trim().toLocaleLowerCase();
    const tagQuery = tag?.trim().toLocaleLowerCase();
    return readMockDatabase().posts
      .filter((post) => !post.is_deleted
        && (!titleQuery || post.title.toLocaleLowerCase().includes(titleQuery))
        && (!tagQuery || post.hashtags.some((item) => item.name.toLocaleLowerCase() === tagQuery)))
      .sort((a, b) => (sort === 'view_count' ? b.view_count - a.view_count : 0) || b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .slice(offset, offset + limit).map(parsePostSummary);
  },
  /** 상세 조회마다 조회수를 증가시켜 저장하고, 호출자가 DB 객체를 바꾸지 못하도록 복사해 반환한다. */
  async getPost(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const post = findPost(data, postId);
    post.view_count += 1;
    saveMockDatabase(data);
    return structuredClone(post);
  },
  /** 인증·필수값·이미지를 검증하고 새 글을 저장한다. 이미지 처리 중 실패하면 게시글을 추가하지 않는다. */
  async createPost(params) {
    const token = await waitForMutation();
    requireMockUser(readMockDatabase());
    validatePostInput(params);
    if (imageReferences(params.content).some((url) => url.startsWith('s3://'))) throw new Error('새 글에는 내부 이미지 참조를 사용할 수 없습니다.');
    const urls = await readImages(params.images);
    assertSession(token);
    // 비동기 이미지 변환 사이에 발생한 쓰기를 보존하려고 DB와 인증 정보를 다시 읽는다.
    const data = readMockDatabase();
    const user = requireMockUser(data);
    let imageId = Math.max(0, ...data.posts.flatMap((item) => item.images.map((image) => image.id))) + 1;
    const images = urls.map((url) => ({ id: imageId, image_url: `${url}#mock-image-${imageId++}` }));
    const content = mapMarkdownImages(params.content, (url) => {
      const index = params.image_ids?.indexOf(url.slice(9)) ?? -1;
      return url.startsWith('upload://') && index >= 0 ? images[index].image_url : url;
    });
    const now = new Date().toISOString();
    const post: PostEntity = {
      id: Math.max(0, ...data.posts.map((item) => item.id)) + 1,
      title: params.title,
      content,
      images,
      author_id: user.id,
      author_account_id: user.account_id,
      author_username: user.username,
      author_image_url: data.profiles?.[user.id]?.profile_image_url ?? null,
      hashtags: makeHashtags(data, params.hashtags ?? []),
      like_count: 0, comment_count: 0, view_count: 0,
      created_at: now, updated_at: now,
      is_deleted: false,
    };
    data.posts.push(post);
    saveMockDatabase(data);
    return structuredClone(post);
  },
  /** 본문 참조/유지 ID를 검증한 후 한 번에 저장한다. 새 업로드는 기존 이미지 뒤에 추가한다. */
  async updatePost(postId, params) {
    const token = await waitForMutation();
    findOwnedPost(readMockDatabase(), postId);
    validatePostInput(params);
    const urls = await readImages(params.images);
    assertSession(token);
    const data = readMockDatabase();
    const post = findOwnedPost(data, postId);
    const kept = params.keep_image_ids ?? post.images.map((image) => image.id);
    if (kept.some((id) => !post.images.some((image) => image.id === id))) throw new Error('해당 게시글의 이미지 ID만 유지할 수 있습니다.');
    const content = params.content ?? post.content;
    const references = new Set(imageReferences(content));
    if (post.images.some((image) => !kept.includes(image.id) && references.has(image.image_url))) throw new Error('이미지 삭제 전 본문 참조도 제거해주세요.');
    let imageId = Math.max(0, ...data.posts.flatMap((item) => item.images.map((image) => image.id))) + 1;
    const added = urls.map((url) => ({ id: imageId, image_url: `${url}#mock-image-${imageId++}` }));
    const nextContent = mapMarkdownImages(content, (url) => {
      const index = params.image_ids?.indexOf(url.slice(9)) ?? -1;
      return url.startsWith('upload://') && index >= 0 ? added[index].image_url : url;
    });
    if (params.title !== undefined) post.title = params.title;
    post.content = nextContent;
    post.images = [...post.images.filter((image) => kept.includes(image.id)), ...added];
    if (params.hashtags !== undefined) post.hashtags = makeHashtags(data, params.hashtags);
    post.updated_at = new Date().toISOString();
    saveMockDatabase(data);
    return structuredClone(post);
  },
  /** 본인 글을 물리적으로 지우지 않고 삭제 표시하여 이후 목록/상세에서 제외한다. */
  async deletePost(postId) {
    await waitForMutation();
    const data = readMockDatabase();
    const post = findOwnedPost(data, postId);
    post.is_deleted = true;
    post.updated_at = new Date().toISOString();
    saveMockDatabase(data);
    return { detail: '게시글이 삭제되었습니다.' };
  },
  /** 시연 DB에서 현재 사용자의 기록만 조회한다. 예제 합계만으로 내 좋아요 여부를 추측하지 않는다. */
  async getLikeStatus(postId) {
    if (!authStorage.getAccessToken()) return null;
    await waitForMockRequest();
    const data = readMockDatabase();
    const user = requireMockUser(data);
    findPost(data, postId);
    return (data.likes[postId] ?? []).includes(user.id);
  },
  /** 사용자별 좋아요 기록과 합계를 함께 갱신한다. 동일 사용자의 중복 등록은 오류로 처리한다. */
  async likePost(postId) {
    await waitForMutation();
    const data = readMockDatabase();
    const user = requireMockUser(data);
    const post = findPost(data, postId);
    const likes = data.likes[postId] ?? [];
    if (likes.includes(user.id)) throw new Error('이미 좋아요한 게시글입니다.');
    data.likes[postId] = [...likes, user.id];
    post.like_count += 1;
    saveMockDatabase(data);
    return { post_id: postId, like_count: post.like_count, is_liked: true };
  },
  /** 현재 사용자가 추가한 좋아요만 취소한다. 예제 기본 좋아요 수는 개별 사용자 기록이 아니다. */
  async unlikePost(postId) {
    await waitForMutation();
    const data = readMockDatabase();
    const user = requireMockUser(data);
    const post = findPost(data, postId);
    const likes = data.likes[postId] ?? [];
    if (!likes.includes(user.id)) throw new Error('좋아요하지 않은 게시글입니다.');
    data.likes[postId] = likes.filter((id) => id !== user.id);
    post.like_count = Math.max(0, post.like_count - 1);
    saveMockDatabase(data);
    return { post_id: postId, like_count: post.like_count, is_liked: false };
  },
};
