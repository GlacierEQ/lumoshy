import { MastraClient } from '@mastra/client-js';

export const setupTerminalAI = (): void => {
  // 初始化Mastra客户端
  const mastraClient = new MastraClient({
    baseUrl: 'http://localhost:4111' // 默认本地开发端口4111
  });

  // 设置全局可访问的客户端实例
  (window as any).mastraClient = mastraClient;

  console.log('Terminal AI assistant initialized');
}; 