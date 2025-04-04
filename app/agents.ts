import type { Agent } from '@mastra/client-js';

// 预定义的智能体ID
const TERMINAL_ASSISTANT_ID = 'terminal-assistant';

// 存储可用的智能体
const agents: Record<string, Agent> = {};

/**
 * 初始化并注册智能体
 */
export const requireAgents = (): void => {
  // 确保mastraClient已初始化
  const mastraClient = (window as any).mastraClient;
  
  if (!mastraClient) {
    console.error('MastraClient is not initialized');
    return;
  }
  
  try {
    // 注册终端助手智能体
    const agent = mastraClient.getAgent(TERMINAL_ASSISTANT_ID);
    if (agent) {
      agents[TERMINAL_ASSISTANT_ID] = agent;
      console.log(`Registered agent: ${TERMINAL_ASSISTANT_ID}`);
    }
  } catch (error) {
    console.error('Failed to register agent:', error);
  }
};

/**
 * 获取指定ID的智能体
 */
export const getAgent = (agentId: string): Agent | undefined => {
  return agents[agentId];
};

/**
 * 获取所有已注册的智能体ID
 */
export const getAgentIds = (): string[] => {
  return Object.keys(agents);
};