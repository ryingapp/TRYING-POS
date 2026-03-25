import { Client } from "ssh2";
import { readFileSync, existsSync, statSync, createReadStream } from "fs";
import { homedir } from "os";
import { resolve } from "path";

const HOST = "72.62.40.134";
const USER = "root";
const PASS = "Dr&4f1guk@jID,W)d?tg";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const LOCAL_SCRIPT = resolve("script/_delete_users.cjs");

function exec(conn, cmd) {
  return new Promise((res, rej) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return rej(err);
      let out = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d.toString()); });
      stream.stderr.on("data", (d) => { process.stderr.write(d.toString()); });
      stream.on("close", () => res(out));
    });
  });
}

function upload(conn, localPath, remotePath) {
  return new Promise((res, rej) => {
    conn.sftp((err, sftp) => {
      if (err) return rej(err);
      const rs = createReadStream(localPath);
      const ws = sftp.createWriteStream(remotePath);
      ws.on("close", res);
      ws.on("error", rej);
      rs.pipe(ws);
    });
  });
}

const conn = new Client();
conn.on("ready", async () => {
  console.log("=== SSH Connected ===\n");
  await upload(conn, LOCAL_SCRIPT, "/tmp/_delete_users.cjs");
  await exec(conn, "node /tmp/_delete_users.cjs");
  conn.end();
});

conn.on("error", (err) => console.error("Connection error:", err.message));

const connectOptions = {
  host: HOST, port: 22, username: USER,
  tryKeyboard: true, readyTimeout: 30000,
  algorithms: {
    kex: ['ecdh-sha2-nistp256','ecdh-sha2-nistp384','ecdh-sha2-nistp521','diffie-hellman-group-exchange-sha256','diffie-hellman-group14-sha256'],
    serverHostKey: ['ssh-ed25519','ecdsa-sha2-nistp256','rsa-sha2-512','rsa-sha2-256','ssh-rsa'],
  },
};
if (existsSync(SSH_KEY_PATH)) {
  connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
} else {
  connectOptions.password = PASS;
}
conn.connect(connectOptions);

