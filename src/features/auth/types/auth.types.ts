// POST /auth/login Request Body
export interface LoginRequest {
  account_id: string;
  password:  string;
}

// POST /auth/login Response Body
export interface LoginResponse {
  access_token:  string;
  refresh_token: string;
  token_type:    string; // "bearer"
  user_id:       number;
  account_id:    string;
}