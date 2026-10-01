// @ts-nocheck Shared scanner is bundled for native Vercel ESM during build.
import {createScheduledPaperHandler} from '../server/scheduledPaper.js';
import {observeSharedPaper} from '../server/sharedPaperObservation.bundle.mjs';
export default createScheduledPaperHandler({observe:observeSharedPaper});
