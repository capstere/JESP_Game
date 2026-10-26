export {AI} from './transport.mjs?v=6.3.0';
export {Workspace} from './workspace.mjs?v=6.4.0';
// Stable provider/workspace implementation, with the current progress-aware agent runner.
export * from './runtime.mjs?v=5.1.1';
import {parseJSON,check} from './runtime.mjs?v=5.1.1';
import {runAgentImpl} from './runner.mjs?v=6.4.0';
export const VERSION='6.4.0';
export function runAgent(options){return runAgentImpl(options,{parseJSON,check});}
