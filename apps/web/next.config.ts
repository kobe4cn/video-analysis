import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // monorepo 中的 workspace 包需要显式声明以便 Next.js 进行编译
  transpilePackages: ["@repo/shared"],
};

export default nextConfig;
