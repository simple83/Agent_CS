import type { ProfileUpdate, UserProfile } from '../types/profile.types';

/** 선택 정보의 null은 정상으로 받고, 필드 누락·잘못된 타입은 조용히 빈 값으로 숨기지 않는다. */
export const parseProfile = (value: unknown): UserProfile => {
  if (!value || typeof value !== 'object') throw new Error('프로필 응답이 올바르지 않습니다.');
  const item = value as Record<string, unknown>;
  if (!Number.isSafeInteger(item.id) || Number(item.id) < 1 || typeof item.account_id !== 'string'
    || !item.account_id || typeof item.is_active !== 'boolean'
    || ['created_at', 'updated_at'].some((key) => typeof item[key] !== 'string' || !Number.isFinite(Date.parse(item[key] as string)))
    || ['username', 'email', 'bio', 'profile_image_url'].some((key) => item[key] !== null && typeof item[key] !== 'string')) {
    throw new Error('프로필 응답의 필수 정보가 없거나 형식이 올바르지 않습니다.');
  }
  return { id: item.id as number, account_id: item.account_id, username: item.username as string | null,
    email: item.email as string | null, bio: item.bio as string | null, profile_image_url: item.profile_image_url as string | null,
    is_active: item.is_active, created_at: item.created_at as string, updated_at: item.updated_at as string };
};

/** 업로드 전 기본 파일 형식·크기를 검사한다. 파일 내용과 실제 저장 권한은 서버가 다시 검증한다. */
export const validateProfileImage = (file: File) => {
  if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('프로필 사진은 JPG, PNG, GIF, WebP 파일을 선택해주세요.');
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('프로필 사진은 0바이트보다 크고 5MB 이하여야 합니다.');
};

/** 빈 multipart 필드의 삭제 의미가 확정되지 않아 기존 값은 새 값으로 변경하는 방식만 제공한다. */
export const validateProfileUpdate = (input: ProfileUpdate) => {
  for (const key of ['username', 'email', 'bio'] as const) {
    if (input[key] !== undefined && !input[key].trim()) throw new Error('등록된 정보는 현재 비울 수 없습니다. 새 값으로 변경해주세요.');
  }
  if (input.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('이메일 형식을 확인해주세요.');
  if (input.profile_image) validateProfileImage(input.profile_image);
};
