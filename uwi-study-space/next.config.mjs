/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.0.10.201"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;