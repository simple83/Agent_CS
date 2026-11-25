import { authStorage } from '../../../shared/services/authStorage';
import { readMockDatabase, requireMockUser, saveMockDatabase, waitForMockRequest, getMockProfile } from '../../../shared/mocks/mockStore';
import type { ProfileApi } from '../types/profile.types';
import { validateProfileUpdate } from '../utils/profileContract';
import { ApiError } from '../../../shared/services/ApiError';

/** 지연·파일 읽기 사이 계정이 바뀌면 다른 사용자에게 이전 폼을 적용하지 않는다. */
const checkSession = (token: string | null) => {
  if (!token || authStorage.getAccessToken() !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 시도해주세요.');
};

/** 기존 저장소에 프로필만 추가한다. 작성 글·댓글·이미지 등 시연 데이터를 초기화하지 않는다. */
export const mockProfileApi: ProfileApi = {
  async getMe() {
    const token = authStorage.getAccessToken();
    await waitForMockRequest();
    checkSession(token);
    const data = readMockDatabase();
    return structuredClone(getMockProfile(data, requireMockUser(data).id));
  },

  async updateMe(input) {
    validateProfileUpdate(input);
    const token = authStorage.getAccessToken();
    await waitForMockRequest();
    checkSession(token);
    requireMockUser(readMockDatabase());
    let image: string | undefined;
    if (input.profile_image) {
      const bytes = new Uint8Array(await input.profile_image.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      image = `data:${input.profile_image.type};base64,${btoa(binary)}`;
    }
    checkSession(token);
    const data = readMockDatabase();
    const user = requireMockUser(data);
    if (input.email && Object.values(data.profiles ?? {}).some((profile) => profile.id !== user.id && profile.email === input.email)) {
      throw new ApiError('이미 사용 중인 이메일입니다.', 409);
    }
    const profile = { ...getMockProfile(data, user.id), updated_at: new Date().toISOString() };
    for (const key of ['username', 'email', 'bio'] as const) if (input[key] !== undefined) profile[key] = input[key];
    if (image) profile.profile_image_url = image;
    data.profiles ??= {};
    data.profiles[user.id] = profile;
    // 서버의 작성자 조인 조회를 재현한다. 이미 작성한 글·댓글에도 새 닉네임과 사진을 반영한다.
    for (const post of data.posts) if (post.author_id === user.id) {
      post.author_username = profile.username;
      post.author_image_url = profile.profile_image_url;
    }
    for (const comment of data.comments) if (comment.user_id === user.id) {
      comment.username = profile.username;
      comment.profile_image_url = profile.profile_image_url;
    }
    saveMockDatabase(data);
    return structuredClone(profile);
  },
};
