import { Hono } from 'hono';
import type { Env } from '../types';
import {
  fetchUserByUsername,
  updateUserTokenFields,
  generateUUID,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  getJwtSecret,
  createCookie
} from '../utils';

const auth = new Hono<{ Bindings: Env }>();

// POST /api/account/login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>();
    
    if (!body.username || !body.password) {
      return c.json({ error: 'Missing credentials' }, 400);
    }
    
    // Fetch user from database
    const user = await fetchUserByUsername(c.env.DB, body.username);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Verify password
    const validPassword = await verifyPassword(body.password, user.pass_hash);
    if (!validPassword) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Generate new token credentials
    const newTokenId = generateUUID();
    const newTokenSlug = generateUUID();
    
    // Update user token fields in database
    const updated = await updateUserTokenFields(c.env.DB, user.id, newTokenId, newTokenSlug);
    if (!updated) {
      return c.json({ error: 'Internal server error' }, 500);
    }
    
    // Ensure user storage directories exist in R2
    // R2 doesn't require explicit directory creation - objects are just stored with prefixes
    
    // Generate tokens
    const secret = await getJwtSecret(c.env);
    const accessToken = await createAccessToken(user.storage_dir, secret);
    const refreshToken = await createRefreshToken(newTokenId, user.storage_dir, newTokenSlug);
    
    // Set refresh token cookie
    const cookie = createCookie('refresh-tok', refreshToken, {
      path: '/api/tokens/refresh',
      maxAge: 7 * 60 * 60, // 7 hours
      httpOnly: true,
      secure: true,
      sameSite: 'Strict'
    });
    
    return c.json(accessToken, 200, {
      'Set-Cookie': cookie
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/account/logout
auth.post('/logout', async (c) => {
  // Expire the refresh token cookie
  const cookie = createCookie('refresh-tok', '', {
    path: '/api/tokens/refresh',
    maxAge: -1,
    httpOnly: true,
    secure: true,
    sameSite: 'Strict'
  });
  
  return c.text('Logged out', 200, {
    'Set-Cookie': cookie
  });
});

export { auth };
