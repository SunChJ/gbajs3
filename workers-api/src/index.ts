import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, AccessTokenPayload } from './types';
import { auth } from './routes/auth';
import { tokens } from './routes/tokens';
import { files } from './routes/files';
import { verifyAccessToken, getJwtSecret } from './utils';

type Variables = {
  storePath: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS configuration
app.use('*', cors({
  origin: (origin) => {
    // In production, set this to your frontend domain
    // For development, allow localhost
    if (!origin) return '*';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    // Add your production domains here
    if (origin.includes('pages.dev') || origin.includes('workers.dev')) {
      return origin;
    }
    return origin; // Allow all for now - restrict in production
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Accept', 'Content-Type', 'Content-Length', 'Accept-Encoding', 'Authorization'],
  exposeHeaders: ['Set-Cookie'],
  credentials: true
}));

// Root endpoint
app.get('/', (c) => {
  return c.text('Hello World! This is a GBA file/auth server, powered by Cloudflare Workers.');
});

// Mount auth routes (no authentication required)
app.route('/api/account', auth);

// Mount token routes (no authentication required for refresh)
app.route('/api/tokens', tokens);

// Authentication middleware for protected routes
app.use('/api/rom/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const bearerPrefix = 'Bearer ';
  
  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.slice(bearerPrefix.length);
  const secret = await getJwtSecret(c.env);
  const claims = await verifyAccessToken(token, secret);
  
  if (!claims) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Store the claims in context for use in handlers
  c.set('storePath', claims.store);
  
  await next();
});

app.use('/api/save/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  const bearerPrefix = 'Bearer ';
  
  if (!authHeader || !authHeader.startsWith(bearerPrefix)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.slice(bearerPrefix.length);
  const secret = await getJwtSecret(c.env);
  const claims = await verifyAccessToken(token, secret);
  
  if (!claims) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Store the claims in context for use in handlers
  c.set('storePath', claims.store);
  
  await next();
});

// Mount file routes (protected by middleware above)
app.route('/api', files);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
