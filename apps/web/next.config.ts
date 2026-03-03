import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // monorepo 中的 workspace 包需要显式声明以便 Next.js 进行编译
  transpilePackages: ["@repo/shared"],
  // standalone 模式输出独立运行包，容器部署时无需完整 node_modules
  output: "standalone",
};

export default nextConfig;
