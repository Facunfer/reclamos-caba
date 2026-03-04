import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Leaflet needs this to avoid SSR issues
  transpilePackages: ["leaflet", "react-leaflet"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
