// The minute scheduler endpoint (pg_cron `shared-paper-minute`). It runs the automation tick: paper runs
// every minute plus one due background job (signals, validation, market day, filings).
import {createAutomationHandler} from './_automation.js';
export default createAutomationHandler();
