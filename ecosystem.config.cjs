module.exports = {
  apps: [{
    name: "trying",
    script: "npx",
    args: "tsx server/index.ts",
    cwd: "/opt/trying",
    env: {
      NODE_ENV: "production",
      PORT: 5000,
    },
    env_file: "/opt/trying/.env",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "512M",
    autorestart: true,
    watch: false,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/var/log/trying-error.log",
    out_file: "/var/log/trying-out.log",
    merge_logs: true,
  }]
};
