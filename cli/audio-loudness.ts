import { rebuildAudioLoudness } from "./helpers/audio-loudness";

const force = process.argv.slice(2).includes("--force");
rebuildAudioLoudness({ force });
