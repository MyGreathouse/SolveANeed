import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SolveANeed",
    short_name: "SolveANeed",
    description: "Every Need Deserves a Solution.",
    start_url: "/",
    display: "standalone",
    background_color: "#10223B",
    theme_color: "#10223B",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
