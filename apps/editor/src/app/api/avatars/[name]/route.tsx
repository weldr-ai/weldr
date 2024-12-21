import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { generateGradient } from "~/lib/gradient";

export const config = {
  runtime: "edge",
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const text = url.searchParams.get("text");
  const size = Number(url.searchParams.get("size") || "120");
  const rounded = Number(url.searchParams.get("rounded") || "0");
  const [username, type] = name?.split(".") || [];
  const fileType = type?.includes("svg") ? "svg" : "png";

  const gradient = await generateGradient(username || `${Math.random()}`);

  if (fileType === "svg") {
    const svgContent = `
      <svg
        width="${size}"
        height="${size}"
        viewBox="0 0 ${size} ${size}"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg">
        <title>${username}</title>
        <g>
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="${gradient.fromColor}" />
              <stop offset="100%" stop-color="${gradient.toColor}" />
            </linearGradient>
          </defs>
          <rect
            fill="url(#gradient)"
            x="0"
            y="0"
            width="${size}"
            height="${size}"
            rx="${rounded}"
            ry="${rounded}"
          />
          ${
            text
              ? `
            <text
              x="50%"
              y="50%"
              alignment-baseline="central"
              dominant-baseline="central"
              text-anchor="middle"
              fill="#fff"
              font-family="sans-serif"
              font-size="${(size * 0.9) / text.length}"
            >${text}</text>
          `
              : ""
          }
        </g>
      </svg>
    `.trim();

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  }

  // For PNG, we still use ImageResponse but with a simplified SVG structure
  const pngSvg = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{username}</title>
      <g>
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradient.fromColor} />
            <stop offset="100%" stopColor={gradient.toColor} />
          </linearGradient>
        </defs>
        <rect
          fill="url(#gradient)"
          x="0"
          y="0"
          width={size}
          height={size}
          rx={rounded}
          ry={rounded}
        />
      </g>
    </svg>
  );

  return new ImageResponse(pngSvg, {
    width: size,
    height: size,
  });
}
