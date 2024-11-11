import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "IntegraMind",
    short_name: "IntegraMind",
    description:
      "Create backend APIs, automation workflows, and integrations using only plain English, no coding required!",
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
