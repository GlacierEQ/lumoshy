import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { weatherWorkflow } from './workflows';
import { weatherAgent } from './agents';
import { terminalAgent } from './agents/terminalAgent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent, terminalAgent },
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
