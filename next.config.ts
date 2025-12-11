import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    PR_NUMBER: process.env.PR_NUMBER,
    DEPLOY_URL: process.env.DEPLOY_URL,
    BUILD_TIME: process.env.BUILD_TIME,
  },
};

export default nextConfig;
