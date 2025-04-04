import { memoryVectorDb } from '@mastra/memory';
import { MemoryManager } from '@mastra/core/memory';
import { openai } from '@ai-sdk/openai';

// 创建本地内存向量存储
const memory = memoryVectorDb({
  // 使用内存向量数据库作为存储引擎
  namespace: 'terminal-history',
});

// 创建记忆管理器
export const terminalMemory = new MemoryManager({
  vectorDb: memory,
  embeddingModel: openai.embedding('text-embedding-3-small'),
  // 添加为会话记忆提供上下文的函数
  formatSessionContext: (messages) => {
    return `历史命令会话:\n${messages
      .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
      .join('\n')}`;
  },
  // 为相似性搜索提供格式化函数
  formatSimilarityContext: (messages) => {
    return `相关命令记录:\n${messages
      .map((m) => `${m.content}`)
      .join('\n')}`;
  },
});

// 保存命令到记忆
export async function saveCommandToMemory(
  command: string, 
  output: string,
  threadId: string
) {
  try {
    // 保存用户命令
    await terminalMemory.saveMessage({
      threadId,
      message: {
        role: 'user',
        content: `执行命令: ${command}`
      }
    });

    // 保存命令输出
    await terminalMemory.saveMessage({
      threadId,
      message: {
        role: 'assistant',
        content: `命令结果:\n${output}`
      }
    });
    
    return true;
  } catch (error) {
    console.error('保存命令到记忆失败:', error);
    return false;
  }
}

// 获取相关命令记录
export async function getRelatedCommands(query: string, limit = 5) {
  try {
    // 使用语义搜索查找相关命令
    const results = await terminalMemory.searchSimilarMessages({
      query,
      limit,
      filter: (message) => message.role === 'user' && message.content.includes('执行命令')
    });
    
    // 提取命令
    return results.map(item => {
      const content = item.message.content;
      const commandMatch = content.match(/执行命令: (.+)$/);
      return {
        command: commandMatch ? commandMatch[1] : content,
        score: item.score
      };
    });
  } catch (error) {
    console.error('获取相关命令失败:', error);
    return [];
  }
}

// 获取会话历史记录
export async function getSessionHistory(threadId: string, limit = 10) {
  try {
    const history = await terminalMemory.getMessages({ 
      threadId,
      limit
    });
    
    return history;
  } catch (error) {
    console.error('获取会话历史失败:', error);
    return [];
  }
} 