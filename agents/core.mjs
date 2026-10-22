// Stable provider/workspace implementation, with the current progress-aware agent runner.
export * from './runtime.mjs?v=5.1.1';
import {parseJSON,check} from './runtime.mjs?v=5.1.1';
import {runAgentImpl} from './runner.mjs?v=5.1.1';
export const VERSION='5.1.1';
export function runAgent(options){return runAgentImpl(options,{parseJSON,check});}
