import { Client } from "ssh2";
import { readFileSync, createReadStream, statSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const PASS = "Dr&4f1guk@jID,W)d?tg";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const APP_DIR = "/opt/trying";
const DOMAIN = "tryingpos.com";
const DB_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require";

const archivePath = resolve("C:\\Users\\msaz1\\Downloads\\trying-deploy.tar.gz");
const deployScript = resolve("C:\\Users\\msaz1\\Downloads\\trying-recovry-main\\trying-recovry-main\\deploy.sh");
const backupScript = resolve("C:\\Users\\msaz1\\Downloads\\trying-recovry-main\\trying-recovry-main\\backup-db.sh");
const restoreScript = resolve("C:\\Users\\msaz1\\Downloads\\trying-recovry-main\\trying-recovry-main\\restore-db.sh");
const setupBackupScript = resolve("C:\\Users\\msaz1\\Downloads\\trying-recovry-main\\trying-recovry-main\\setup-backup.sh");

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "", stderr = "";
      stream.on("data", (d) => { stdout += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d.toString()); });
      stream.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const size = statSync(localPath).size;
      const sizeMB = (size / 1024 / 1024).toFixed(1);
      console.log(`  Uploading ${localPath} (${sizeMB} MB) -> ${remotePath}`);
      
      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      
      let uploaded = 0;
      readStream.on("data", (chunk) => {
        uploaded += chunk.length;
        const pct = ((uploaded / size) * 100).toFixed(0);
        process.stdout.write(`\r  Progress: ${pct}%`);
      });
      
      writeStream.on("close", () => { console.log("\n  Upload complete!"); resolve(); });
      writeStream.on("error", reject);
      readStream.pipe(writeStream);
    });
  });
}

async function main() {
  const conn = new Client();
  
  console.log("=========================================");
  console.log("  TRYING - Live Deployment");
  console.log("=========================================\n");
  
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", (err) => {
      console.error("SSH Error:", err.message);
      console.error("Error level:", err.level);
      reject(err);
    });
    console.log(`Connecting to ${USER}@${HOST}...`);
    
    // Try SSH key first, fallback to password
    const connectOptions = { 
      host: HOST, 
      port: 22, 
      username: USER, 
      tryKeyboard: true,
      readyTimeout: 30000,
      algorithms: {
        kex: ['ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group-exchange-sha256','diffie-hellman-group14-sha256','diffie-hellman-group14-sha1'],
        serverHostKey: ['ssh-ed25519','ecdsa-sha2-nistp256','rsa-sha2-512','rsa-sha2-256','ssh-rsa'],
      },
    };
    
    // Use SSH key if available
    if (existsSync(SSH_KEY_PATH)) {
      console.log(`Using SSH key: ${SSH_KEY_PATH}`);
      connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
    } else {
      console.log("Using password authentication");
      connectOptions.password = PASS;
    }
    
    conn.connect(connectOptions);
    conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
      console.log("Keyboard-interactive auth requested");
      finish([PASS]);
    });
  });
  
  console.log("Connected!\n");

  // Step 1: Upload archive
  console.log("[1/5] Uploading project archive...");
  await uploadFile(conn, archivePath, "/tmp/trying-deploy.tar.gz");

  // Step 2: Upload deploy script
  console.log("\n[2/5] Uploading deploy script...");
  await uploadFile(conn, deployScript, "/tmp/deploy.sh");

  // Step 3: Upload backup scripts
  console.log("\n[3/5] Uploading backup script...");
  await uploadFile(conn, backupScript, APP_DIR + "/backup-db.sh");
  
  console.log("\n[4/5] Uploading restore script...");
  await uploadFile(conn, restoreScript, APP_DIR + "/restore-db.sh");
  await uploadFile(conn, setupBackupScript, APP_DIR + "/setup-backup.sh");

  // Step 4: Run deploy script
  console.log("\n[5/5] Running deployment...\n");
  const result = await exec(conn, "chmod +x /tmp/deploy.sh && bash /tmp/deploy.sh 2>&1");
  
  if (result.code !== 0) {
    console.error(`\nDeployment script exited with code ${result.code}`);
  }

  conn.end();
  console.log("\nDone! Connection closed.");
}

main().catch((err) => {
  console.error("Deployment failed:", err.message);
  process.exit(1);
});
