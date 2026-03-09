import { Client } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const PASS = "Dr&4f1guk@jID,W)d?tg";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = "";
      stream.on("data", (d) => { stdout += d.toString(); });
      stream.on("close", (code) => resolve(stdout));
    });
  });
}

async function main() {
  const conn = new Client();
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

  console.log("Finding schema.ts on remote...");
  const content = await exec(conn, "find /opt/trying -name schema.ts");
  console.log(content);
  
  conn.end();
}

main().catch(console.error);