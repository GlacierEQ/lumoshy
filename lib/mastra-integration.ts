import { MastraClient } from '@mastra/client-js';

// 创建Mastra客户端实例，连接到hyperai项目中运行的Mastra服务
// 默认使用localhost:4111
export const mastraClient = new MastraClient({
  baseUrl: 'http://localhost:4111'
});

/**
 * Mastra终端类，用于与终端智能体交互
 */
export class MastraTerminal {
  private client: MastraClient;
  private agentId: string;

  constructor(options: { baseUrl: string, agentId: string }) {
    this.client = new MastraClient({ baseUrl: options.baseUrl });
    this.agentId = options.agentId;
  }

  /**
   * 连接到Mastra服务
   * @returns 是否连接成功
   */
  async connect(): Promise<boolean> {
    try {
      // 检查健康状态
      const response = await fetch(`${this.client.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error('连接Mastra服务失败:', error);
      return false;
    }
  }

  /**
   * 处理自然语言命令
   * @param options 处理选项
   * @returns 处理结果
   */
  async processNaturalLanguage(options: { 
    input: string; 
    currentDir: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const agent = this.client.getAgent(this.agentId);
      const response = await agent.generate({
        messages: [
          {
            role: 'user',
            content: `
当前目录: ${options.currentDir}
用户请求: ${options.input}
`
          }
        ]
      });
      
      return {
        success: true,
        output: response.text
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || '未知错误'
      };
    }
  }

  /**
   * 流式处理自然语言命令
   * @param options 处理选项
   * @param onChunk 数据块回调
   * @param onComplete 完成回调
   */
  async streamNaturalLanguage(
    options: { input: string; currentDir: string },
    onChunk: (chunk: string) => void,
    onComplete: (result: { success: boolean; output: string; error?: string }) => void
  ): Promise<void> {
    try {
      const agent = this.client.getAgent(this.agentId);
      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: `
当前目录: ${options.currentDir}
用户请求: ${options.input}
`
          }
        ]
      });
      
      let fullText = '';
      
      await response.processDataStream({
        onTextPart: (text) => {
          fullText += text;
          onChunk(text);
        }
      });
      
      onComplete({
        success: true,
        output: fullText
      });
    } catch (error: any) {
      onComplete({
        success: false,
        output: '',
        error: error.message || '未知错误'
      });
    }
  }

  /**
   * 检查文本是否为自然语言
   * @param text 输入文本
   * @returns 是否为自然语言
   */
  static isNaturalLanguage(text: string): boolean {
    // 简化的启发式判断，实际应用中可能需要更复杂的逻辑
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    // 如果文本以常见命令开头，可能不是自然语言
    const commonCommands = [
      'ls', 'cd', 'mkdir', 'rm', 'cp', 'mv', 'cat', 'grep', 'find',
      'git', 'npm', 'yarn', 'pnpm', 'node', 'python', 'java', 'go',
      'docker', 'kubectl', 'ssh', 'curl', 'wget', 'sudo', 'apt',
      'brew', 'yum', 'pip', 'vim', 'nano', 'echo', 'touch'
    ];
    
    // 检查是否以常见命令开头
    const firstWord = text.trim().split(' ')[0];
    if (commonCommands.includes(firstWord)) {
      return false;
    }
    
    // 检查是否包含有意义的单词数量（至少3个单词视为自然语言）
    const words = text.trim().split(/\s+/).filter(word => word.length > 1);
    if (words.length >= 3) {
      return true;
    }
    
    // 检查是否以"如何"、"怎么"等疑问词开头
    const questionPrefixes = ['how', 'what', 'why', 'when', 'where', 'who', 'which', 
                             '如何', '怎么', '为什么', '什么', '谁', '何时', '哪里'];
    for (const prefix of questionPrefixes) {
      if (text.toLowerCase().startsWith(prefix)) {
        return true;
      }
    }
    
    return false;
  }
}

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