import { realApiUrl } from '../../../shared/config/apiMode';
import { apiFetch } from '../../../shared/services/apiFetch';
import { authStorage } from '../../../shared/services/authStorage';
import { ApiError } from '../../../shared/services/ApiError';
import type { ProfileApi, UserProfile } from '../types/profile.types';
import { parseProfile, validateProfileUpdate } from '../utils/profileContract';

/** 요청 시작 시 토큰을 고정한다. 응답 검증 오류나 실패 시 입력 초안은 UI에서 보존한다. */
const request = async (options?: RequestInit): Promise<UserProfile> => {
  const token = authStorage.getAccessToken();
  if (!token) throw new Error('로그인 후 이용해주세요.');
  const response = await apiFetch(realApiUrl('/users/me'), {
    ...options, headers: { Authorization: `bearer ${token}` },
  });
  if (!response.ok) {
    // 검증 응답 원문에는 개인정보가 포함될 수 있어 상태별 안내만 노출한다.
    const messages: Record<number, string> = { 401: '로그인이 만료되었습니다. 다시 로그인해주세요.',
      409: '이미 사용 중인 이메일입니다.', 422: '프로필 입력 형식이나 사진 파일을 확인해주세요.' };
    throw new ApiError(messages[response.status] ?? '프로필 처리에 실패했습니다. 잠시 후 다시 시도해주세요.', response.status);
  }
  return parseProfile(await response.json());
};

/** Content-Type은 브라우저가 multipart boundary와 함께 지정하게 한다. 변경하지 않은 값은 생략한다. */
export const realProfileApi: ProfileApi = {
  getMe: () => request(),
  async updateMe(input) {
    validateProfileUpdate(input);
    const form = new FormData();
    for (const key of ['username', 'email', 'bio'] as const) if (input[key] !== undefined) form.append(key, input[key]);
    if (input.profile_image) form.append('profile_image', input.profile_image);
    return request({ method: 'PATCH', body: form });
  },
};
