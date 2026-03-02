import { Client } from 'ssh2';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
const conn = new Client();
const KEY = resolve(homedir(), '.ssh', 'id_ed25519_trying');
conn.on('ready', () => {
  conn.exec(grep -c '16a34a' /opt/trying/dist/public/assets/index-s4lx6jtu.js; echo '---'; grep -c 'wa.me' /opt/trying/dist/public/assets/index-s4lx6jtu.js; echo '---'; grep -co 'MessageCircle' /opt/trying/dist/public/assets/index-s4lx6jtu.js; echo '---NGINX---'; curl -sI http://tryingpos.com/assets/index-s4lx6jtu.js | grep -i 'cache', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.stderr.on('data', d => out += d.toString());
    stream.on('close', () => { console.log(out); conn.end(); });
  });
});
const opts = { host: '72.62.40.134', port: 22, username: 'root' };
if (existsSync(KEY)) opts.privateKey = readFileSync(KEY);
else opts.password = 'Dr&4f1guk@jID,W)d?tg';
conn.connect(opts);
