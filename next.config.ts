import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo has its own README/CLAUDE.md conventions; skip Next's
  // auto-generated AGENTS.md/CLAUDE.md agent-rules files.
  agentRules: false,
};

export default nextConfig;
