/**
 * Mastra 连接器 - 将Mastra智能体与Hyper终端集成
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { MastraTerminal } from './mastra-integration';

// 将exec函数Promise化
const execPromise = promisify(exec);

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