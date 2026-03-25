import { Client } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const PASS = "Dr&4f1guk@jID,W)d?tg";
const LOCAL_FILE = resolve("server/routes.ts");
const REMOTE_FILE = "/opt/trying/server/routes.ts";

const conn = new Client();

const connectOptions = {
    host: HOST,
    port: 22,
    username: USER,
    readyTimeout: 30000,
    tryKeyboard: true,
    algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ssh-ed25519']
    }
};

if (existsSync(SSH_KEY_PATH)) {
    console.log("Using SSH key from:", SSH_KEY_PATH);
    connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
} else {
    console.log("Using password authentication.");
    connectOptions.password = PASS;
}

conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
    console.log('Server requested keyboard-interactive authentication');
    finish([PASS]);
});

console.log("Connecting to server...");

conn.on("ready", () => {
  console.log("Connected to server successfully");
  conn.sftp((err, sftp) => {
    if (err) {
        console.error("SFTP error:", err);
        conn.end();
        return;
    }
    
    console.log("Creating backup of remote file...");
    // Backup first
    const backupName = REMOTE_FILE + ".bak-" + Date.now();
    sftp.rename(REMOTE_FILE, backupName, (err) => {
        if (err) console.log("Note: Backup skipped or failed (maybe file doesn't exist yet):", err.message);
        else console.log("Backup created:", backupName);
        
        console.log("Uploading local server/routes.ts...");
        sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
            if (err) {
                console.error("Upload failed:", err);
                conn.end();
                return;
            }
            console.log("Uploaded successfully!");
            
            // Restart server
            console.log("Restarting PM2 process 'trying'...");
            conn.exec("pm2 restart trying", (err, stream) => {
                if (err) {
                    console.error("Exec error:", err);
                    conn.end();
                    return;
                }
                stream.on("close", (code) => {
                    console.log("Server restart command finished with code", code);
                    conn.end();
                }).on("data", (data) => {
                    process.stdout.write(data.toString());
                }).stderr.on("data", (data) => {
                    process.stderr.write(data.toString());
                });
            });
        });
    });
  });
}).on("error", (err) => {
    console.error("Connection error:", err);
}).connect(connectOptions);
