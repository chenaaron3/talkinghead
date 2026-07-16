/** Audio kept at word boundaries when collapsing inter-word pauses */
export const WORD_MARGIN_SEC = 0.25;
/** Inter-word pause longer than this is cut during process */
export const PROCESS_GAP_THRESHOLD_SEC = 2 * WORD_MARGIN_SEC;
/** Inter-word pause shown/cuttable in scissor tool */
export const SCISSOR_GAP_THRESHOLD_SEC = WORD_MARGIN_SEC;
export const SCISSOR_MARGIN_SEC = SCISSOR_GAP_THRESHOLD_SEC / 2;
/** Extra audio kept around filler cuts so consonants aren't clipped */
export const FILLER_PADDING_SEC = 0.5;
