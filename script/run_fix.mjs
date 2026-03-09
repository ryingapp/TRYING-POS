import { Client } from "ssh2";
import { readFileSync, createReadStream, statSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const PASS = "Dr&4f1guk@jID,W)d?tg";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const APP_DIR = "/opt/trying";

const fixScriptPath = resolve("C:\\Users\\msaz1\\Downloads\\trying-recovry-main\\trying-recovry-main\\script\\fix_missing_columns.cjs");

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (code) => resolve(code));
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      writeStream.on("close", () => resolve());
      writeStream.on("error", reject);
      readStream.pipe(writeStream);
    });
  });
}

function fetchRemoteEnv(conn) {
    return new Promise((resolve, reject) => {
        conn.exec("cat /opt/trying/.env", (err, stream) => {
            if (err) return reject(err);
            let stdout = "";
            stream.on("data", (d) => { stdout += d.toString(); });
            stream.on("close", (code) => {
                if (code !== 0) return resolve(null);
                const match = stdout.match(/DATABASE_URL=(.+)/);
                resolve(match ? match[1].trim() : null);
            });
        });
    });
}

async function main() {
  const conn = new Client();
  console.log("Connecting to run fix...");
  
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", reject);
    const connectOptions = { 
        host: HOST, 
        port: 22, 
        username: USER, 
        tryKeyboard: true, 
        algorithms: {
            kex: ['ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group-exchange-sha256','diffie-hellman-group14-sha256','diffie-hellman-group14-sha1'],
            serverHostKey: ['ssh-ed25519','ecdsa-sha2-nistp256','rsa-sha2-512','rsa-sha2-256','ssh-rsa'],
        }
    };
    if (existsSync(SSH_KEY_PATH)) {
      connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
    } else {
      connectOptions.password = PASS;
    }
    conn.connect(connectOptions);
    conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
      finish([PASS]);
    });
  });

  console.log("Connected.");

  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    dbUrl = await fetchRemoteEnv(conn);
    if (!dbUrl) throw new Error("DATABASE_URL unavailable");
  }

  console.log("Uploading fix script...");
  await uploadFile(conn, fixScriptPath, APP_DIR + "/fix_missing_columns.cjs");

  console.log("Running fix script...");
  await exec(conn, `export DATABASE_URL="${dbUrl}" && node ${APP_DIR}/fix_missing_columns.cjs`);

  conn.end();
}

main().catch(console.error);