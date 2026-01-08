import * as jose from 'jose';
import type { Env, AccessTokenPayload, RefreshTokenPayload, User } from './types';

// Generate a random UUID v4
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Get or generate JWT secret
export async function getJwtSecret(env: Env): Promise<Uint8Array> {
  // In production, you should set JWT_SECRET as an environment variable
  // For now, we use a derived key from the environment
  if (env.JWT_SECRET) {
    return new TextEncoder().encode(env.JWT_SECRET);
  }
  // Fallback: generate a deterministic secret (NOT recommended for production)
  const encoder = new TextEncoder();
  return encoder.encode('gbajs3-default-secret-change-in-production');
}

// Hash password using Web Crypto API (bcrypt is not available in Workers)
// We use PBKDF2 with SHA-256 as a secure alternative
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  // Store as: salt:hash (both base64 encoded)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltB64}:${hashB64}`;
}

// Verify password against stored hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Check if this is a bcrypt hash (starts with $2)
  if (storedHash.startsWith('$2')) {
    // For bcrypt hashes, we need to migrate the user
    // This is a compatibility layer - you may need to run a migration script
    console.warn('bcrypt hash detected - user needs migration');
    return false;
  }
  
  const [saltB64, hashB64] = storedHash.split(':');
  if (!saltB64 || !hashB64) {
    return false;
  }
  
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashB64), c => c.charCodeAt(0));
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hash = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = new Uint8Array(hash);
  
  // Constant-time comparison
  if (hashArray.length !== expectedHash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < hashArray.length; i++) {
    result |= hashArray[i] ^ expectedHash[i];
  }
  
  return result === 0;
}

// Create access token (5 minutes validity)
export async function createAccessToken(storageDir: string, secret: Uint8Array): Promise<string> {
  const payload: AccessTokenPayload = {
    store: storageDir,
    exp: Math.floor(Date.now() / 1000) + 5 * 60 // 5 minutes
  };
  
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(secret);
}

// Create refresh token (7 hours validity)
export async function createRefreshToken(
  tokenId: string,
  storageDir: string,
  tokenSlug: string
): Promise<string> {
  const secret = new TextEncoder().encode(tokenSlug);
  const payload: RefreshTokenPayload = {
    sub: tokenId,
    store: storageDir,
    exp: Math.floor(Date.now() / 1000) + 7 * 60 * 60 // 7 hours
  };
  
  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7h')
    .sign(secret);
}

// Verify access token
export async function verifyAccessToken(
  token: string,
  secret: Uint8Array
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

// Verify refresh token
export async function verifyRefreshToken(
  token: string,
  tokenSlug: string
): Promise<RefreshTokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(tokenSlug);
    const { payload } = await jose.jwtVerify(token, secret);
    return payload as unknown as RefreshTokenPayload;
  } catch {
    return null;
  }
}

// Database helper: fetch user by username
export async function fetchUserByUsername(db: D1Database, username: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT id, username, pass_hash, token_slug, token_id, storage_dir, created_at FROM users WHERE username = ?')
    .bind(username)
    .first<User>();
  
  return result;
}

// Database helper: fetch token slug by token id
export async function fetchTokenSlugByTokenId(db: D1Database, tokenId: string): Promise<string | null> {
  const result = await db
    .prepare('SELECT token_slug FROM users WHERE token_id = ?')
    .bind(tokenId)
    .first<{ token_slug: string }>();
  
  return result?.token_slug ?? null;
}

// Database helper: update user token fields
export async function updateUserTokenFields(
  db: D1Database,
  userId: number,
  tokenId: string,
  tokenSlug: string
): Promise<boolean> {
  const result = await db
    .prepare('UPDATE users SET token_id = ?, token_slug = ? WHERE id = ?')
    .bind(tokenId, tokenSlug, userId)
    .run();
  
  return result.success && (result.meta.changes ?? 0) > 0;
}

// Parse cookie from request
export function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, value] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

// Create Set-Cookie header
export function createCookie(
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  
  return parts.join('; ');
}
