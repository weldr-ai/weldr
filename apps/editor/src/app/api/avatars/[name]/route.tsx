import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { generateGradient } from "~/lib/gradient";

export const config = {
  runtime: "edge",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { email: string } },
) {
  const size = 120;
  const gradient = await generateGradient(params.email);

  const pngSvg = (
    // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradient.fromColor} />
            <stop offset="100%" stopColor={gradient.toColor} />
          </linearGradient>
        </defs>
        <rect fill="url(#gradient)" x="0" y="0" width={size} height={size} />
      </g>
    </svg>
  );

  return new ImageResponse(pngSvg, {
    width: size,
    height: size,
  });
}
