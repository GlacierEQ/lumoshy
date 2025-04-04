/**
 * 命令处理器 - 拦截和处理自然语言命令
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import mastraConnector from './mastra-connector';

// 将exec函数Promise化
const execPromise = promisify(exec);

/**
 * 命令处理结果
 */
export interface CommandResult {
  text: string;
  isNaturalLanguage: boolean;
  shouldExecuteDirectly: boolean;
}

/**
 * 命令处理器类
 */
export class CommandProcessor {
  /**
   * 处理输入命令
   * @param command 输入的命令
   * @param cwd 当前工作目录
   * @returns 处理结果
   */
  public static async processCommand(command: string, cwd?: string): Promise<CommandResult> {
    // 检查是否为自然语言
    const isNaturalLanguage = mastraConnector.isNaturalLanguage(command);
    
    if (!isNaturalLanguage) {
      // 不是自然语言，直接执行命令
      return {
        text: command,
        isNaturalLanguage: false,
        shouldExecuteDirectly: true
      };
    }
    
    try {
      // 初始化Mastra连接器
      await mastraConnector.initialize();
      
      // 处理自然语言命令，生成实际的终端命令
      const processedCommand = await mastraConnector.processNaturalLanguage(command, cwd);
      
      // 返回处理结果
      return {
        text: processedCommand,
        isNaturalLanguage: true,
        shouldExecuteDirectly: false // 不直接执行，而是显示在终端中
      };
    } catch (error) {
      console.error('处理命令时出错:', error);
      return {
        text: `处理命令时出错: ${error}`,
        isNaturalLanguage: true,
        shouldExecuteDirectly: false
      };
    }
  }
  
  /**
   * 流式处理输入命令
   * @param command 输入的命令
   * @param cwd 当前工作目录
   * @param onChunk 数据块回调
   * @param onComplete 完成回调
   */
  public static async streamProcessCommand(
    command: string,
    cwd: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete: (result: CommandResult) => void
  ): Promise<void> {
    // 检查是否为自然语言
    const isNaturalLanguage = mastraConnector.isNaturalLanguage(command);
    
    if (!isNaturalLanguage) {
      // 不是自然语言，直接执行命令
      onComplete({
        text: command,
        isNaturalLanguage: false,
        shouldExecuteDirectly: true
      });
      return;
    }
    
    try {
      // 初始化Mastra连接器
      await mastraConnector.initialize();
      
      // 流式处理自然语言命令
      await mastraConnector.streamNaturalLanguage(
        command,
        cwd,
        onChunk,
        (processedCommand) => {
          onComplete({
            text: processedCommand,
            isNaturalLanguage: true,
            shouldExecuteDirectly: false // 不直接执行，而是显示在终端中
          });
        }
      );
    } catch (error) {
      console.error('流式处理命令时出错:', error);
      onComplete({
        text: `处理命令时出错: ${error}`,
        isNaturalLanguage: true,
        shouldExecuteDirectly: false
      });
    }
  }
  
  /**
   * 执行命令并获取结果
   * @param command 要执行的命令
   * @param cwd 当前工作目录
   * @returns 执行结果
   */
  public static async executeCommand(command: string, cwd?: string): Promise<string> {
    try {
      const { stdout, stderr } = await execPromise(command, { cwd: cwd || process.cwd() });
      return stdout || stderr;
    } catch (error: any) {
      return `执行命令出错: ${error.message || error}`;
    }
  }
} 