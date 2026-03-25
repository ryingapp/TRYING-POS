// Script to run fix_missing_columns.cjs on the server
import { Client } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const PASS = "Dr&4f1guk@jID,W)d?tg";
const LOCAL_FILE = resolve("script/fix_missing_columns.cjs");
const REMOTE_FILE = "/opt/trying/fix_missing_columns_v2.cjs";

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
    
    console.log("Uploading local script/fix_missing_columns.cjs...");
    sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
        if (err) {
            console.error("Upload failed:", err);
            conn.end();
            return;
        }
        console.log("Uploaded successfully!");
        
        // Run the script
        console.log("Running schema fix script on server...");
        const remoteCmd = `cd /opt/trying && export $(cat .env | xargs) && node fix_missing_columns_v2.cjs`;
        console.log(`Executing: ${remoteCmd}`);
        
        conn.exec(remoteCmd, (err, stream) => {
            if (err) {
                console.error("Exec error:", err);
                conn.end();
                return;
            }
            stream.on("close", (code) => {
                console.log("Script finished with code", code);
                conn.end();
            }).on("data", (data) => {
                process.stdout.write(data.toString());
            }).stderr.on("data", (data) => {
                process.stderr.write(data.toString());
            });
        });
    });
  });
}).on("error", (err) => {
    console.error("Connection error:", err);
}).connect(connectOptions);
