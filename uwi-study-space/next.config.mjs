/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.10.201"],
  turbopack: {
    root: process.cwd(),
  },
  
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000", 
        "*.app.github.dev",
        ...(process.env.CODESPACE_NAME ? [`${process.env.CODESPACE_NAME}-3000.app.github.dev`] : [])
      ],
    },
  },
};

export default nextConfig;