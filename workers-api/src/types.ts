// Cloudflare Workers environment bindings
export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ENVIRONMENT: string;
  JWT_SECRET?: string;
}

// User model matching the database schema
export interface User {
  id: number;
  username: string;
  pass_hash: string;
  token_slug: string | null;
  token_id: string | null;
  storage_dir: string;
  created_at: string;
}

// User credentials for login
export interface UserCredentials {
  username: string;
  password: string;
}

// JWT payload types
export interface AccessTokenPayload {
  store: string;
  exp: number;
  [key: string]: unknown;
}

export interface RefreshTokenPayload {
  sub: string;
  store: string;
  exp: number;
  [key: string]: unknown;
}

// API response types
export interface ApiError {
  error: string;
  message?: string;
}

// File listing response
export interface FileListResponse {
  files: string[];
}
