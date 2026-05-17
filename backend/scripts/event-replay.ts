#!/usr/bin/env npx tsx
/**
 * Production event replay CLI
 * Usage:
 *   npx tsx backend/scripts/event-replay.ts rebuild-read-models
 *   npx tsx backend/scripts/event-replay.ts replay-all [--dry-run]
 *   npx tsx backend/scripts/event-replay.ts replay-aggregate service <id>
 */
import { rebuildReadModels, replayAllEvents, replayAggregate } from "../src/core/events/replay";

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "rebuild-read-models": {
      const r = await rebuildReadModels();
      console.log(`Rebuilt read models from ${r.count} events`);
      break;
    }
    case "replay-all": {
      const dryRun = args.includes("--dry-run");
      const r = await replayAllEvents({ dryRun });
      console.log(`Replayed ${r.processed} events (project mode)${dryRun ? " [dry-run]" : ""}`);
      break;
    }
    case "replay-aggregate": {
      const [type, id] = args;
      if (!type || !id) throw new Error("Usage: replay-aggregate <type> <id>");
      const r = await replayAggregate(type, id);
      console.log(`Replayed ${r.processed} events for ${type}:${id}`);
      break;
    }
    default:
      console.log(`Commands: rebuild-read-models | replay-all | replay-aggregate <type> <id>`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
