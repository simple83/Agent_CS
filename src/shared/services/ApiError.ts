/** HTTP 상태를 보존한다. 인증 만료와 네트워크/서버 장애를 구별하는 데 사용한다. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
