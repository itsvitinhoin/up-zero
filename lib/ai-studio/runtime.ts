/** Disk-backed execution requires a persistent host; Vercel needs a future remote worker adapter. */
export function studioRequiresSetup() {
  return process.env.NODE_ENV === "production" && (
    process.env.VERCEL === "1" || !process.env.OPENAI_API_KEY || !process.env.AI_STUDIO_DATA_DIR
  );
}
