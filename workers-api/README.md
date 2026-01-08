# GBAjs3 Cloudflare Workers API

This is the Cloudflare Workers backend for gbajs3, rewritten from Go to TypeScript.

## Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 database

```bash
npm run db:create
```

After running this command, copy the database ID and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "gbajs3-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # Replace this
```

### 4. Create R2 bucket

```bash
npm run r2:create
```

### 5. Run database migrations

For local development:
```bash
npm run db:migrate:local
```

For production:
```bash
npm run db:migrate
```

### 6. Set JWT secret (recommended for production)

```bash
wrangler secret put JWT_SECRET
```

## Development

```bash
npm run dev
```

## Deployment

```bash
npm run deploy
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Health check |
| POST | `/api/account/login` | No | User login |
| POST | `/api/account/logout` | Yes | User logout |
| POST | `/api/tokens/refresh` | Cookie | Refresh access token |
| GET | `/api/rom/list` | Yes | List user's ROMs |
| GET | `/api/rom/download?rom=file.gba` | Yes | Download ROM |
| POST | `/api/rom/upload` | Yes | Upload ROM (multipart) |
| GET | `/api/save/list` | Yes | List user's saves |
| GET | `/api/save/download?save=file.sav` | Yes | Download save |
| POST | `/api/save/upload` | Yes | Upload save (multipart) |

## Creating Users

Currently, there's no registration endpoint. To create users, use the D1 console:

```bash
wrangler d1 execute gbajs3-db --command "INSERT INTO users (username, pass_hash, storage_dir) VALUES ('testuser', '<hashed_password>', 'uuid-storage-dir')"
```

You'll need to hash passwords using the PBKDF2 format. A utility script will be added later.

## Migrating from Go Backend

The main differences:
1. **Password hashing**: Uses PBKDF2 instead of bcrypt (bcrypt not available in Workers)
2. **Storage**: Uses R2 instead of local filesystem
3. **Database**: Uses D1 (SQLite) instead of PostgreSQL

If migrating existing users, you'll need to:
1. Export users from PostgreSQL
2. Re-hash passwords using PBKDF2
3. Import into D1
