export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: UserProfile;
}

export type UserRole = 'admin' | 'client' | 'lab';

export interface TokenPayload {
  sub: number;
  username: string;
  role: UserRole;
  client_id?: number;
  lab_id?: number;
  iat: number;
  exp: number;
}
