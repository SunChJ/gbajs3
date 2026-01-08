import { Hono } from 'hono';
import type { Env } from '../types';

const files = new Hono<{ Bindings: Env }>();

// Helper to get store path from context (set by auth middleware)
function getStorePath(c: { get: (key: string) => string | undefined }): string | null {
  return c.get('storePath') ?? null;
}

// GET /api/rom/list
files.get('/rom/list', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const prefix = `roms/${storePath}/`;
    const listed = await c.env.STORAGE.list({ prefix });
    
    const files = listed.objects
      .map((obj: R2Object) => obj.key.replace(prefix, ''))
      .filter((name: string) => name.length > 0);
    
    return c.json(files);
  } catch (error) {
    console.error('List ROMs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/save/list
files.get('/save/list', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const prefix = `saves/${storePath}/`;
    const listed = await c.env.STORAGE.list({ prefix });
    
    const files = listed.objects
      .map((obj: R2Object) => obj.key.replace(prefix, ''))
      .filter((name: string) => name.length > 0);
    
    return c.json(files);
  } catch (error) {
    console.error('List saves error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/rom/download?rom=filename.gba
files.get('/rom/download', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const filename = c.req.query('rom');
  if (!filename) {
    return c.json({ error: 'Missing rom parameter' }, 400);
  }
  
  try {
    const key = `roms/${storePath}/${filename}`;
    const object = await c.env.STORAGE.get(key);
    
    if (!object) {
      return c.json({ error: 'ROM not found' }, 404);
    }
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/x-gba-rom');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Download ROM error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/save/download?save=filename.sav
files.get('/save/download', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const filename = c.req.query('save');
  if (!filename) {
    return c.json({ error: 'Missing save parameter' }, 400);
  }
  
  try {
    const key = `saves/${storePath}/${filename}`;
    const object = await c.env.STORAGE.get(key);
    
    if (!object) {
      return c.json({ error: 'Save not found' }, 404);
    }
    
    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Download save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/rom/upload (multipart form with 'rom' field)
files.post('/rom/upload', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const formData = await c.req.formData();
    const file = formData.get('rom') as File | null;
    
    if (!file) {
      return c.json({ error: 'Missing rom file' }, 400);
    }
    
    // Validate file extension
    const validExtensions = ['.gba', '.gbc', '.gb', '.zip', '.7z'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(ext)) {
      return c.json({ error: 'Invalid file format. Expected .gba/.gbc/.gb/.zip/.7z' }, 400);
    }
    
    // Upload to R2
    const key = `roms/${storePath}/${file.name}`;
    await c.env.STORAGE.put(key, file.stream(), {
      httpMetadata: {
        contentType: 'application/x-gba-rom'
      }
    });
    
    return c.json({ success: true, filename: file.name });
  } catch (error) {
    console.error('Upload ROM error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/save/upload (multipart form with 'save' field)
files.post('/save/upload', async (c) => {
  const storePath = getStorePath(c);
  if (!storePath) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const formData = await c.req.formData();
    const file = formData.get('save') as File | null;
    
    if (!file) {
      return c.json({ error: 'Missing save file' }, 400);
    }
    
    // Upload to R2
    const key = `saves/${storePath}/${file.name}`;
    await c.env.STORAGE.put(key, file.stream(), {
      httpMetadata: {
        contentType: 'application/octet-stream'
      }
    });
    
    return c.json({ success: true, filename: file.name });
  } catch (error) {
    console.error('Upload save error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { files };
