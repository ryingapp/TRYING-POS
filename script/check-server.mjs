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
      let stdout = "", stderr = "";
      stream.on("data", (d) => { stdout += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d.toString()); });
      stream.on("close", (code) => resolve({ stdout, stderr, code }));
    });
  });
}

async function main() {
  const conn = new Client();
  console.log("Checking server status...");
  
  await new Promise((resolve, reject) => {
    conn.on("ready", resolve);
    conn.on("error", reject);
    const connectOptions = { 
      host: HOST, port: 22, username: USER, tryKeyboard: true,
      readyTimeout: 30000,
    };
    if (existsSync(SSH_KEY_PATH)) {
      connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
    } else {
      connectOptions.password = PASS;
    }
    conn.connect(connectOptions);
    conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => finish([PASS]));
  });
  
  console.log("Connected. Running checks...\n");

  console.log("--- PM2 Status ---");
  await exec(conn, "pm2 status");

  console.log("\n--- Last 20 lines of PM2 Logs ---");
  await exec(conn, "pm2 logs trying --lines 20 --nostream");

  conn.end();
}

main().catch(console.error);