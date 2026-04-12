import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000", 
        "*.app.github.dev",
        // Dynamically grab the current Codespace name and inject it into the URL!
        ...(process.env.CODESPACE_NAME ? [`${process.env.CODESPACE_NAME}-3000.app.github.dev`] : [])
      ],
    },
  },
  
  // ... keep any other config settings you already had in here!
};

export default nextConfig;