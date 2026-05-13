/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // FastAPI URL available in server-side code
  env: {
    FASTAPI_URL: process.env.FASTAPI_URL || "http://localhost:8000",
  },
};

export default nextConfig;
