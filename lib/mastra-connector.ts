/**
 * Mastra 连接器 - 将Mastra智能体与Hyper终端集成
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { MastraTerminal } from './mastra-integration';
import { MastraClient } from '@mastra/client-js';
import * as fs from 'fs';
import * as path from 'path';

// 将exec函数Promise化
const execPromise = promisify(exec);
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// 创建Mastra客户端实例
export const mastraClient = new MastraClient({
  baseUrl: process.env.MASTRA_API_URL || 'http://localhost:4111'
});

/**
 * Mastra终端连接器单例
 */
class MastraConnector {
  private static instance: MastraConnector;
  private terminal: MastraTerminal | null = null;
  private isInitialized: boolean = false;
  private isMastraServerRunning: boolean = false;

  /**
   * 私有构造函数，保证单例
   */
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MastraConnector {
    if (!MastraConnector.instance) {
      MastraConnector.instance = new MastraConnector();
    }
    return MastraConnector.instance;
  }

  /**
   * 初始化Mastra连接器
   * @returns 初始化是否成功
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // 检查Mastra服务器是否运行
      this.isMastraServerRunning = await this.checkMastraServer();

      if (!this.isMastraServerRunning) {
        console.warn('Mastra服务器未运行，无法启用智能终端功能');
        return false;
      }

      // 创建Mastra终端实例
      this.terminal = new MastraTerminal({
        baseUrl: 'http://localhost:4111',
        agentId: 'terminalAgent'
      });

      // 连接到Mastra服务
      const connected = await this.terminal.connect();
      if (!connected) {
        console.error('无法连接到Mastra服务器');
        return false;
      }

      this.isInitialized = true;
      console.log('Mastra智能终端已初始化');
      return true;
    } catch (error) {
      console.error('初始化Mastra连接器时出错:', error);
      return false;
    }
  }

  /**
   * 检查Mastra服务器是否运行
   */
  private async checkMastraServer(): Promise<boolean> {
    try {
      // 尝试连接到Mastra服务器
      const response = await fetch('http://localhost:4111/api/health', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查文本是否为自然语言
   * @param text 输入文本
   */
  public isNaturalLanguage(text: string): boolean {
    return MastraTerminal.isNaturalLanguage(text);
  }

  /**
   * 处理自然语言命令
   * @param input 自然语言输入
   * @param cwd 当前工作目录
   * @returns 处理结果
   */
  public async processNaturalLanguage(input: string, cwd?: string): Promise<string> {
    if (!this.isInitialized || !this.terminal) {
      await this.initialize();
      if (!this.terminal) {
        return `无法处理自然语言命令: Mastra终端未初始化`;
      }
    }

    try {
      const result = await this.terminal.processNaturalLanguage({
        input,
        currentDir: cwd || process.cwd()
      });

      if (!result.success) {
        return `处理失败: ${result.error || '未知错误'}`;
      }

      return result.output;
    } catch (error) {
      console.error('处理自然语言时出错:', error);
      return `处理出错: ${error}`;
    }
  }

  /**
   * 流式处理自然语言命令
   * @param input 自然语言输入
   * @param cwd 当前工作目录
   * @param onChunk 数据块回调
   * @param onComplete 完成回调
   */
  public async streamNaturalLanguage(
    input: string, 
    cwd: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete: (result: string) => void
  ): Promise<void> {
    if (!this.isInitialized || !this.terminal) {
      await this.initialize();
      if (!this.terminal) {
        onComplete(`无法处理自然语言命令: Mastra终端未初始化`);
        return;
      }
    }

    try {
      await this.terminal.streamNaturalLanguage(
        {
          input,
          currentDir: cwd || process.cwd()
        },
        onChunk,
        (result) => {
          if (!result.success) {
            onComplete(`处理失败: ${result.error || '未知错误'}`);
          } else {
            onComplete(result.output);
          }
        }
      );
    } catch (error) {
      console.error('流式处理自然语言时出错:', error);
      onComplete(`处理出错: ${error}`);
    }
  }
}

// 导出连接器单例
export default MastraConnector.getInstance();

/**
 * 获取当前工作目录信息
 */
export async function getCurrentDirectoryInfo() {
  try {
    const { stdout: pwd } = await execPromise('pwd');
    const currentDir = pwd.trim();
    
    // 获取目录内容
    const files = await readdirAsync(currentDir);
    
    // 获取每个文件的信息
    const filePromises = files.map(async (file) => {
      const filePath = path.join(currentDir, file);
      try {
        const stat = await statAsync(filePath);
        return {
          name: file,
          isDirectory: stat.isDirectory(),
          size: stat.size,
          modified: stat.mtime
        };
      } catch (error: any) {
        return {
          name: file,
          error: 'Unable to access file info'
        };
      }
    });
    
    const fileDetails = await Promise.all(filePromises);
    
    return {
      currentDirectory: currentDir,
      files: fileDetails
    };
  } catch (error: any) {
    console.error('获取目录信息时出错:', error);
    return { 
      currentDirectory: 'Unknown',
      files: [],
      error: error.message
    };
  }
}

/**
 * 获取项目上下文信息
 */
export async function getProjectContext() {
  try {
    // 尝试检测项目类型
    const projectInfo = await detectProjectType();
    
    // 获取环境变量
    const { stdout: envOutput } = await execPromise('env');
    const envVars = envOutput.split('\n')
      .filter(line => line.trim() !== '')
      .map(line => line.trim());
    
    return {
      ...projectInfo,
      environmentVariables: envVars
    };
  } catch (error: any) {
    console.error('获取项目上下文时出错:', error);
    return {
      type: 'unknown',
      error: error.message
    };
  }
}

/**
 * 检测项目类型
 */
async function detectProjectType() {
  const { stdout: pwd } = await execPromise('pwd');
  const currentDir = pwd.trim();
  
  try {
    // 检查是否存在package.json
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageData = JSON.parse(await readFileAsync(packagePath, 'utf8'));
      
      // 检查依赖判断框架类型
      const dependencies = {
        ...packageData.dependencies || {},
        ...packageData.devDependencies || {}
      };
      
      let type = 'node';
      let framework = 'unknown';
      
      if (dependencies.react) {
        type = 'react';
        
        if (dependencies.next) {
          framework = 'next.js';
        } else if (dependencies['react-native']) {
          framework = 'react-native';
        } else {
          framework = 'react';
        }
      } else if (dependencies.vue) {
        type = 'vue';
        
        if (dependencies.nuxt) {
          framework = 'nuxt.js';
        } else {
          framework = 'vue';
        }
      } else if (dependencies.express) {
        framework = 'express';
      } else if (dependencies.koa) {
        framework = 'koa';
      }
      
      return {
        type,
        framework,
        packageJson: packageData,
        languages: ['javascript', 'typescript']
      };
    }
    
    // 检查是否存在go.mod
    if (fs.existsSync(path.join(currentDir, 'go.mod'))) {
      return {
        type: 'go',
        languages: ['go']
      };
    }
    
    // 检查是否存在Cargo.toml
    if (fs.existsSync(path.join(currentDir, 'Cargo.toml'))) {
      return {
        type: 'rust',
        languages: ['rust']
      };
    }
    
    // 检查其他文件类型
    const files = await readdirAsync(currentDir);
    
    // 根据文件扩展名判断主要语言
    const extensions = files.reduce((acc: Record<string, number>, file) => {
      const ext = path.extname(file).toLowerCase();
      if (ext && ext !== '.') {
        acc[ext] = (acc[ext] || 0) + 1;
      }
      return acc;
    }, {});
    
    // 排序找出最常见的扩展名
    const sortedExts = Object.entries(extensions)
      .sort(([, countA], [, countB]) => (countB as number) - (countA as number))
      .map(([ext]) => ext);
    
    // 根据扩展名映射到语言
    const languageMap: Record<string, string> = {
      '.py': 'python',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'c++',
      '.cs': 'c#',
      '.rb': 'ruby',
      '.php': 'php',
      '.scala': 'scala',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    
    const languages = sortedExts
      .map(ext => languageMap[ext])
      .filter(Boolean);
    
    return {
      type: languages[0] || 'unknown',
      languages: languages.length > 0 ? languages : ['unknown']
    };
  } catch (error: any) {
    console.error('检测项目类型时出错:', error);
    return {
      type: 'unknown',
      error: error.message
    };
  }
}

/**
 * 调用终端智能体并提供上下文
 */
export async function callTerminalAgentWithContext(input: string, threadId: string) {
  try {
    // 获取上下文信息
    const dirInfo = await getCurrentDirectoryInfo();
    const projectInfo = await getProjectContext();
    
    // 获取终端智能体实例
    const agent = mastraClient.getAgent('terminalAgent');
    
    // 构建包含上下文的提示
    const contextPrompt = `
当前上下文:
当前目录: ${dirInfo.currentDirectory}
项目类型: ${projectInfo.type || 'unknown'}
${projectInfo.framework ? `框架: ${projectInfo.framework}` : ''}
主要语言: ${projectInfo.languages?.join(', ') || 'unknown'}

用户的请求: ${input}
`;
    
    // 调用智能体生成响应
    const response = await agent.generate({
      messages: [
        {
          role: 'user',
          content: contextPrompt
        }
      ],
      threadId
    });
    
    return response.text;
  } catch (error) {
    console.error('调用智能体时出错:', error);
    return `智能体调用失败: ${error.message || '未知错误'}`;
  }
}

/**
 * 流式调用终端智能体并提供上下文
 */
export async function streamTerminalAgentWithContext(
  input: string,
  onChunk: (chunk: string) => void,
  threadId: string
) {
  try {
    // 获取上下文信息
    const dirInfo = await getCurrentDirectoryInfo();
    const projectInfo = await getProjectContext();
    
    // 获取终端智能体实例
    const agent = mastraClient.getAgent('terminalAgent');
    
    // 构建包含上下文的提示
    const contextPrompt = `
当前上下文:
当前目录: ${dirInfo.currentDirectory}
项目类型: ${projectInfo.type || 'unknown'}
${projectInfo.framework ? `框架: ${projectInfo.framework}` : ''}
主要语言: ${projectInfo.languages?.join(', ') || 'unknown'}

用户的请求: ${input}
`;
    
    // 流式调用智能体
    const response = await agent.stream({
      messages: [
        {
          role: 'user',
          content: contextPrompt
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
  } catch (error) {
    console.error('流式调用终端智能体时出错:', error);
    onChunk(`智能体调用失败: ${error.message || '未知错误'}`);
  }
} 