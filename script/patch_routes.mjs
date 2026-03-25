import { Client } from "ssh2";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const HOST = "72.62.40.134";
const USER = "root";
const PASS = "Dr&4f1guk@jID,W)d?tg";
const LOCAL_FILE = resolve("server/routes.ts");
const REMOTE_FILE = "/opt/trying/server/routes.ts";

const conn = new Client();

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
    sftp.rename(REMOTE_FILE, REMOTE_FILE + ".bak-" + Date.now(), (err) => {
        if (err) console.log("Note: Backup skipped or failed (maybe file doesn't exist yet):", err.message);
        else console.log("Backup created.");
        
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
}).connect({
  host: HOST,
  port: 22,
  username: USER,
  password: PASS,
  readyTimeout: 30000
});
