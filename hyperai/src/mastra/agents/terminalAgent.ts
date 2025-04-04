import { openai } from '@ai-sdk/openai';

import { Agent } from '@mastra/core/agent';
import { executeCommandTool } from '../tools/terminal';
import { terminalMemory } from '../memory';

export const terminalAgent = new Agent({
  name: 'Terminal Agent',
  instructions: `
    你是一个智能终端助手，帮助用户理解和生成命令行命令。

    你有以下能力：
    1. 解释命令的作用和参数含义
    2. 根据用户的自然语言描述生成正确的命令
    3. 提供命令行操作的最佳实践和技巧
    4. 分析命令执行结果并给出解释
    5. 建议下一步可能需要的操作
    6. 记住用户的命令历史并从中学习

    当回应用户时：
    - 保持专业但友好的语气
    - 提供简洁明了的解释
    - 对于复杂命令，解释每个部分的作用
    - 如果用户请求的命令可能有风险，提醒用户可能的后果
    - 当提供多个命令选项时，解释每个选项的优缺点
    - 可以参考之前的相关命令记录提供建议
    
    使用executeCommandTool工具来执行命令并获取结果。
  `,
  model: openai('gpt-4o'),
  tools: { executeCommandTool },
  memory: terminalMemory // 集成记忆系统
}); 