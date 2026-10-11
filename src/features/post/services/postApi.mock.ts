import type { PostApi } from '../types/postApi.types';
import type { Hashtag, PostEntity } from '../types/post.types';
import {
  readMockDatabase, requireMockUser, saveMockDatabase, waitForMockRequest,
} from '../../../shared/mocks/mockStore';
import type { MockDatabase } from '../../../shared/mocks/mockStore';

const findPost = (data: MockDatabase, postId: number) => {
  const post = data.posts.find((item) => item.id === postId && !item.is_deleted);
  if (!post) throw new Error('존재하지 않는 게시글입니다.');
  return post;
};

const findOwnedPost = (data: MockDatabase, postId: number) => {
  const user = requireMockUser(data);
  const post = findPost(data, postId);
  if (post.author_id !== user.id) throw new Error('본인이 작성한 게시글만 수정하거나 삭제할 수 있습니다.');
  return post;
};

const makeHashtags = (data: MockDatabase, names: string[]): Hashtag[] => {
  const known = new Map(data.posts.flatMap((post) => post.hashtags).map((tag) => [tag.name, tag]));
  let nextId = Math.max(0, ...[...known.values()].map((tag) => tag.id)) + 1;
  const unique = [...new Set(names.map((name) => name.trim().replace(/^#/, '')).filter(Boolean))];
  return unique.map((name) => known.get(name) ?? { id: nextId++, name });
};

const validateText = (value: string) => {
  if (!value.trim()) throw new Error('제목과 내용을 모두 입력해주세요.');
};

// Small demo images are stored as data URLs so they survive page reloads.
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

export const mockPostApi: PostApi = {
  async getPosts({ title, tag } = {}) {
    await waitForMockRequest();
    const titleQuery = title?.trim().toLocaleLowerCase();
    const tagQuery = tag?.trim().replace(/^#/, '').toLocaleLowerCase();
    return readMockDatabase().posts
      .filter((post) => !post.is_deleted
        && (!titleQuery || post.title.toLocaleLowerCase().includes(titleQuery))
        && (!tagQuery || post.hashtags.some((item) => item.name.toLocaleLowerCase() === tagQuery)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  },
  async getPost(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const post = findPost(data, postId);
    post.view_count += 1;
    saveMockDatabase(data);
    return structuredClone(post);
  },
  async createPost(params) {
    await waitForMockRequest();
    requireMockUser(readMockDatabase());
    validateText(params.title);
    validateText(params.content);
    const images = await readImages(params.images);
    // Read again after image conversion to preserve intervening writes.
    const data = readMockDatabase();
    const user = requireMockUser(data);
    const now = new Date().toISOString();
    const post: PostEntity = {
      id: Math.max(0, ...data.posts.map((item) => item.id)) + 1,
      title: params.title,
      content: params.content,
      image_urls: images,
      author_id: user.id,
      author_account_id: user.account_id,
      author_username: user.username,
      author_image_url: '',
      hashtags: makeHashtags(data, params.hashtags ?? []),
      like_count: 0, comment_count: 0, view_count: 0,
      created_at: now, updated_at: now,
      is_blurred: false, is_deleted: false, report_count: 0,
    };
    data.posts.push(post);
    saveMockDatabase(data);
    return structuredClone(post);
  },
  async updatePost(postId, params) {
    await waitForMockRequest();
    findOwnedPost(readMockDatabase(), postId);
    if (params.title !== undefined) validateText(params.title);
    if (params.content !== undefined) validateText(params.content);
    const images = params.images === undefined ? undefined : await readImages(params.images);
    const data = readMockDatabase();
    const post = findOwnedPost(data, postId);
    if (params.title !== undefined) post.title = params.title;
    if (params.content !== undefined) post.content = params.content;
    if (images !== undefined) post.image_urls = images;
    if (params.hashtags !== undefined) post.hashtags = makeHashtags(data, params.hashtags);
    post.updated_at = new Date().toISOString();
    saveMockDatabase(data);
    return structuredClone(post);
  },
  async deletePost(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const post = findOwnedPost(data, postId);
    post.is_deleted = true;
    post.updated_at = new Date().toISOString();
    saveMockDatabase(data);
    return { detail: '게시글이 삭제되었습니다.' };
  },
  async likePost(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const user = requireMockUser(data);
    const post = findPost(data, postId);
    const likes = data.likes[postId] ?? [];
    if (likes.includes(user.id)) throw new Error('이미 좋아요한 게시글입니다.');
    data.likes[postId] = [...likes, user.id];
    post.like_count += 1;
    saveMockDatabase(data);
    return { detail: '게시글 좋아요가 등록되었습니다.' };
  },
  async unlikePost(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const user = requireMockUser(data);
    const post = findPost(data, postId);
    const likes = data.likes[postId] ?? [];
    if (!likes.includes(user.id)) throw new Error('좋아요하지 않은 게시글입니다.');
    data.likes[postId] = likes.filter((id) => id !== user.id);
    post.like_count = Math.max(0, post.like_count - 1);
    saveMockDatabase(data);
    return { detail: '게시글 좋아요가 취소되었습니다.' };
  },
};
