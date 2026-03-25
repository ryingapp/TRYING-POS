const { Client: PgClient } = require('pg');

async function main() {
  const client = new PgClient({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('\n=== Searching for wishel.tea@gmail.com ===');
  const res = await client.query(
    "SELECT id, name, email, role, branch_id, restaurant_id FROM users WHERE email = 'wishel.tea@gmail.com'"
  );
  console.log('Found:', res.rows.length, 'user(s)');
  console.log(JSON.stringify(res.rows, null, 2));

  if (res.rows.length === 0) {
    console.log('\nSearching similar emails...');
    const res2 = await client.query(
      "SELECT id, name, email, role, branch_id FROM users WHERE email ILIKE '%wishel%' OR email ILIKE '%tea%'"
    );
    console.log('Similar:', JSON.stringify(res2.rows, null, 2));
  }

  // Also check password hash
  const res3 = await client.query(
    "SELECT id, name, email, role, branch_id, length(password) as pwd_len FROM users WHERE email = 'wishel.tea@gmail.com'"
  );
  if (res3.rows.length > 0) {
    console.log('\nPassword hash length:', res3.rows[0].pwd_len, '(should be > 0 if set)');
  }

  await client.end();
}
main().catch(console.error);

const sshKeyPath = 'C:\\Users\\msaz1\\.ssh\\id_ed25519_trying';
const remoteHost = '72.62.40.134';

const { execSync } = require('child_process');

// Upload and run on remote
const script = `
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
async function main() {
  await client.connect();
  const res = await client.query("SELECT id, name, email, role, branch_id, restaurant_id, password FROM users WHERE email = 'wishel.tea@gmail.com'");
  console.log('USER ROWS:', JSON.stringify(res.rows, null, 2));
  if (res.rows.length === 0) {
    console.log('NO USER FOUND with that email');
    // Search similar
    const res2 = await client.query("SELECT id, name, email, role, branch_id FROM users WHERE email ILIKE '%wishel%' OR email ILIKE '%tea%'");
    console.log('SIMILAR USERS:', JSON.stringify(res2.rows, null, 2));
  }
  await client.end();
}
main().catch(console.error);
`;

fs.writeFileSync('C:\\Users\\msaz1\\Downloads\\_check_user_remote.cjs', script);

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

(async () => {
  await ssh.connect({
    host: remoteHost,
    username: 'root',
    privateKeyPath: sshKeyPath,
  });

  await ssh.putFile('C:\\Users\\msaz1\\Downloads\\_check_user_remote.cjs', '/tmp/_check_user_remote.cjs');

  const result = await ssh.execCommand('node /tmp/_check_user_remote.cjs', {
    execOptions: { env: { ...process.env } },
  });

  // Get DATABASE_URL first
  const envResult = await ssh.execCommand("grep DATABASE_URL /opt/trying/.env | head -1");
  const dbUrl = envResult.stdout.trim().replace('DATABASE_URL=', '');

  const result2 = await ssh.execCommand(`DATABASE_URL="${dbUrl}" node /tmp/_check_user_remote.cjs`);
  console.log(result2.stdout);
  if (result2.stderr) console.error('ERR:', result2.stderr);

  ssh.dispose();
})().catch(console.error);
