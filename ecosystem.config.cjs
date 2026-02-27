module.exports = {
  apps: [{
    name: "trying",
    script: "dist/index.cjs",
    cwd: "/opt/trying",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require",
      JWT_SECRET: "tR4y1nG_s3cR3t_k3y_2024_pr0d_v1_xK9mN2pL",
      CORS_ORIGIN: "https://tryingpos.com"
    }
  }]
};
