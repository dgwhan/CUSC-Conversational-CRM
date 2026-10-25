export interface JwtSettings {
  Key: string;
  Issuer: string;
  Audience: string;
  ExpiresInMinutes: number;
}

export interface JwtTokenResult {
  accessToken: string;
  expiresAt: Date;
  ExpiresAt?: Date;
}

export interface JwtUser {
  id: string | number;
  email: string;
  fullName?: string;
  username?: string;
  role?: string;
  tokenVersion?: number;
}
