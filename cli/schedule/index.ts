import { runSchedule } from "./run";

runSchedule(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
