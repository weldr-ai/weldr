import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IntegraMind",
    short_name: "IntegraMind",
    description:
      "Build backend APIs, automation workflows, and data pipelines with no coding, just English!",
    start_url: "/",
    display: "standalone",
    background_color: "#3E63DD",
    theme_color: "#3E63DD",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "any",
      },
    ],
  };
}
