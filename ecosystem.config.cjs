module.exports = {
  apps: [{
    name: "trying",
    script: "npx",
    args: "tsx server/index.ts",
    cwd: "/opt/trying",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }]
};
