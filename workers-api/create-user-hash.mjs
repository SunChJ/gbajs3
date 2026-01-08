// Script to generate password hash for D1 database
// Run with: node create-user-hash.mjs

async function hashPassword(password) {
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
  
  const saltB64 = Buffer.from(salt).toString('base64');
  const hashB64 = Buffer.from(hash).toString('base64');
  return `${saltB64}:${hashB64}`;
}

const password = 'testpass123';
hashPassword(password).then(hash => {
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nSQL to insert user:');
  console.log(`INSERT INTO users (username, pass_hash, storage_dir) VALUES ('testuser', '${hash}', '${crypto.randomUUID()}');`);
});
