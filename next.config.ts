import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js otherwise appends its own agent-rules block to this repo's
  // CLAUDE.md on every `next dev`/`next build`, clobbering our operating
  // instructions.
  agentRules: false,
  // The dev-only "N" build-activity/dev-tools indicator defaults to
  // bottom-left — exactly where the investigation composer's "+ Attach"
  // control sits at narrow widths. Live QA (chrome-devtools MCP, 390px)
  // confirmed the reported "Attach label clips to 'tach'" defect is this
  // dev-only <nextjs-portal> overlay sitting on top of real content, not
  // a product bug (it does not exist in a production build). Moved out
  // of the way rather than left to keep tripping up dev-mode QA.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
