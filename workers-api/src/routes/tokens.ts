import { Hono } from 'hono';
import type { Env } from '../types';
import {
  fetchTokenSlugByTokenId,
  verifyRefreshToken,
  createAccessToken,
  getJwtSecret,
  getCookie
} from '../utils';

const tokens = new Hono<{ Bindings: Env }>();

// POST /api/tokens/refresh
tokens.post('/refresh', async (c) => {
  try {
    // Get refresh token from cookie
    const refreshToken = getCookie(c.req.raw, 'refresh-tok');
    if (!refreshToken) {
      return c.json({ error: 'No refresh token' }, 401);
    }
    
    // Decode the token to get the token ID (without verification first)
    // We need the token ID to look up the token slug for verification
    const parts = refreshToken.split('.');
    if (parts.length !== 3) {
      return c.json({ error: 'Invalid token format' }, 401);
    }
    
    let payload: { sub?: string; store?: string };
    try {
      payload = JSON.parse(atob(parts[1]));
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
    
    if (!payload.sub) {
      return c.json({ error: 'Invalid token payload' }, 401);
    }
    
    // Fetch the token slug from database
    const tokenSlug = await fetchTokenSlugByTokenId(c.env.DB, payload.sub);
    if (!tokenSlug) {
      return c.json({ error: 'Token not found' }, 401);
    }
    
    // Now verify the refresh token with the slug
    const claims = await verifyRefreshToken(refreshToken, tokenSlug);
    if (!claims) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
    
    // Generate new access token
    const secret = await getJwtSecret(c.env);
    const accessToken = await createAccessToken(claims.store, secret);
    
    return c.json(accessToken);
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { tokens };
