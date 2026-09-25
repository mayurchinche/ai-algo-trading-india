// @ts-nocheck Vercel compiles the shared TypeScript scanner for server-side observations.
import {createSharedPaperHandler} from '../server/sharedPaper.js';
import {observeSharedPaper} from '../server/sharedPaperObservation.bundle.mjs';
export default createSharedPaperHandler({observe:observeSharedPaper});
