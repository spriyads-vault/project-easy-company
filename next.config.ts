import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js otherwise appends its own agent-rules block to this repo's
  // CLAUDE.md on every `next dev`/`next build`, clobbering our operating
  // instructions.
  agentRules: false,
};

export default nextConfig;
