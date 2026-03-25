import { Client } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
// Using the same key path logic as the other script
const SSH_KEY_PATH = resolve(homedir(), ".ssh", "id_ed25519_trying");
const PASS = "Dr&4f1guk@jID,W)d?tg";

const LOCAL_FILE = resolve("script/debug_db_columns.cjs");
const REMOTE_FILE = "/opt/trying/debug_db_columns.cjs";

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
    // Use privateKey for authentication
    try {
        connectOptions.privateKey = readFileSync(SSH_KEY_PATH);
    } catch (e) {
        console.error("Error reading SSH key:", e);
    }
} else {
    console.log("SSH key not found, using password authentication.");
    connectOptions.password = PASS;
}

conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
    console.log('Server requested keyboard-interactive authentication');
    finish([PASS]);
});

console.log(`Connecting to ${USER}@${HOST}...`);

conn.on("ready", () => {
  console.log("Connected to server successfully");
  
  // Use SFTP to upload the file
  conn.sftp((err, sftp) => {
    if (err) {
        console.error("SFTP error:", err);
        conn.end();
        return;
    }
    
    console.log(`Uploading ${LOCAL_FILE} to ${REMOTE_FILE}...`);
    
    sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
        if (err) {
            console.error("Upload failed:", err);
            conn.end();
            return;
        }
        console.log("Upload successful!");
        
        // Run the script on the server
        console.log("Running debug script on server...");
        // Make sure to load environment variables from .env
        const remoteCmd = `cd /opt/trying && export $(cat .env | xargs) && node debug_db_columns.cjs`;
        console.log(`Executing: ${remoteCmd}`);
        
        conn.exec(remoteCmd, (err, stream) => {
            if (err) {
                console.error("Exec error:", err);
                conn.end();
                return;
            }
            
            let output = "";
            let errorOutput = "";

            stream.on("data", (data) => {
                const text = data.toString();
                output += text;
                process.stdout.write(text);
            }).stderr.on("data", (data) => {
                const text = data.toString();
                errorOutput += text;
                process.stderr.write(text);
            }).on("close", (code) => {
                console.log(`Script finished with code ${code}`);
                conn.end();
            });
        });
    });
  });
}).on("error", (err) => {
    console.error("Connection error:", err);
    conn.end();
}).connect(connectOptions);
