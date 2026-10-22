import type { NextConfig } from "next";

// Only generated images from this project's public `generations` bucket may be optimized.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // The README documents 127.0.0.1 as a local origin (with its own OAuth callback).
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: supabaseUrl
      ? [{
        protocol: "https",
        hostname: new URL(supabaseUrl).hostname,
        port: "",
        pathname: "/storage/v1/object/public/generations/**",
        search: "",
      }]
      : [],
  },
};

export default nextConfig;
