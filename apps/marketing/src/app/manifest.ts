import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IntegraMind",
    short_name: "IntegraMind",
    description:
      "Build custom backends, automate workflows, and integrate data effortlessly with our advanced platform. No coding necessary, just English!",
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
