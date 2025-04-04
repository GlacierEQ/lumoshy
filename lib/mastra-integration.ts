import { MastraClient } from '@mastra/client-js';

// 创建Mastra客户端实例，连接到hyperai项目中运行的Mastra服务
// 默认使用localhost:4111
export const mastraClient = new MastraClient({
  baseUrl: 'http://localhost:4111'
});

/**
 * 调用终端智能体，处理用户输入并生成响应
 * @param input 用户输入的文本
 * @param threadId 会话ID（可选）
 * @returns 智能体的响应
 */
export async function callTerminalAgent(input: string, threadId?: string): Promise<string> {
  try {
    // 获取终端智能体实例
    const agent = mastraClient.getAgent('terminalAgent');
    // 调用智能体生成响应
    const response = await agent.generate({
      messages: [
        {
          role: 'user',
          content: input
        }
      ],
      threadId
    });
    
    return response.text;
  } catch (error: any) {
    console.error('调用终端智能体时出错:', error);
    return `智能体调用失败: ${error.message || '未知错误'}`;
  }
}

/**
 * 执行命令并获取结果
 * @param command 要执行的命令
 * @returns 命令执行结果
 */
export async function executeCommand(command: string): Promise<{stdout: string; stderr: string; success: boolean}> {
  try {
    // 获取终端智能体实例
    const agent = mastraClient.getAgent('terminalAgent');
    // 调用智能体工具函数
    const response = await agent.generate({
      messages: [
        {
          role: 'user',
          content: `执行命令: ${command}`
        }
      ],
      tool_choice: {
        type: 'function',
        function: {
          name: 'execute-command'
        }
      }
    });
    
    // 尝试从工具调用结果中提取输出
    const toolCall = response.toolCalls?.[0];
    if (toolCall && 'function' in toolCall) {
      // 类型断言，确保TS知道这里已经检查了类型
      const functionCall = toolCall as { function: { name: string; result?: string } };
      
      if (functionCall.function.name === 'execute-command') {
        try {
          const result = JSON.parse(functionCall.function.result || '{}');
          return {
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            success: result.success || false
          };
        } catch (e) {
          return {
            stdout: '',
            stderr: '无法解析命令执行结果',
            success: false
          };
        }
      }
    }
    
    return {
      stdout: '',
      stderr: '未能获取命令执行结果',
      success: false
    };
  } catch (error: any) {
    console.error('执行命令时出错:', error);
    return {
      stdout: '',
      stderr: `命令执行失败: ${error.message || '未知错误'}`,
      success: false
    };
  }
}

/**
 * 流式调用终端智能体，用于实时显示响应
 * @param input 用户输入的文本
 * @param onChunk 接收每个响应块的回调函数
 * @param threadId 会话ID（可选）
 */
export async function streamTerminalAgent(
  input: string,
  onChunk: (chunk: string) => void,
  threadId?: string
): Promise<void> {
  try {
    // 获取终端智能体实例
    const agent = mastraClient.getAgent('terminalAgent');
    
    // 流式调用智能体
    const response = await agent.stream({
      messages: [
        {
          role: 'user',
          content: input
        }
      ],
      threadId
    });
    
    // 处理流式响应
    await response.processDataStream({
      onTextPart: (text) => {
        onChunk(text);
      }
    });
  } catch (error: any) {
    console.error('流式调用终端智能体时出错:', error);
    onChunk(`智能体调用失败: ${error.message || '未知错误'}`);
  }
} 