import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const executeCommandTool = createTool({
  id: 'execute-command',
  description: '执行终端命令并返回结果',
  inputSchema: z.object({
    command: z.string().describe('要执行的命令'),
  }),
  outputSchema: z.object({
    stdout: z.string().describe('命令执行的标准输出'),
    stderr: z.string().describe('命令执行的错误输出（如果有）'),
    success: z.boolean().describe('命令是否成功执行'),
  }),
  execute: async ({ command }) => {
    try {
      // 添加一些基本安全检查，防止危险命令
      const dangerousCommands = ['rm -rf', 'mkfs', 'dd', '> /dev/'];
      if (dangerousCommands.some(cmd => command.includes(cmd))) {
        return {
          stdout: '',
          stderr: '安全限制：该命令可能会导致数据丢失，被拒绝执行',
          success: false,
        };
      }

      // 执行命令
      const { stdout, stderr } = await execPromise(command);
      return {
        stdout,
        stderr,
        success: true,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error.message || '命令执行失败',
        success: false,
      };
    }
  },
}); 