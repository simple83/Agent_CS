/** 서버의 내 프로필 응답. 가입 직후에는 선택 정보가 null일 수 있다. */
export interface UserProfile {
  id: number;
  account_id: string;
  username: string | null;
  email: string | null;
  bio: string | null;
  profile_image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** 변경한 항목만 전송한다. 사진 삭제나 기존 문자열을 null로 지우는 계약은 아직 없다. */
export interface ProfileUpdate {
  username?: string;
  email?: string;
  bio?: string;
  profile_image?: File;
}

/** UI는 이 계약만 사용하고 실행 모드에 따라 HTTP/브라우저 저장소 구현을 선택한다. */
export interface ProfileApi {
  getMe(): Promise<UserProfile>;
  updateMe(input: ProfileUpdate): Promise<UserProfile>;
}
