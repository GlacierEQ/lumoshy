/**
 * 命令解析工具函数
 */

/**
 * 从AI回答中提取命令
 * @param response AI生成的响应文本
 * @returns 提取出的命令字符串，如果没有找到则返回空字符串
 */
export function extractCommandFromResponse(response: string): string {
  // 尝试从markdown代码块中提取命令
  const codeBlockMatch = response.match(/```(bash|sh|shell|zsh)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[2]) {
    return codeBlockMatch[2].trim();
  }

  // 尝试从行内代码中提取命令
  const inlineCodeMatch = response.match(/`(.*?)`/);
  if (inlineCodeMatch && inlineCodeMatch[1]) {
    return inlineCodeMatch[1].trim();
  }

  // 尝试提取以$开头的行
  const lines = response.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('$ ')) {
      return trimmedLine.slice(2).trim();
    }
  }

  return '';
}

/**
 * 格式化命令，处理多行命令等特殊情况
 * @param command 原始命令字符串
 * @returns 格式化后的命令
 */
export function formatCommand(command: string): string {
  // 移除命令中的注释
  let formattedCommand = command.replace(/#.*$/gm, '').trim();
  
  // 处理多行命令，替换换行符为分号
  formattedCommand = formattedCommand.replace(/\\\s*\n/g, ' ');
  
  // 移除多余空格
  formattedCommand = formattedCommand.replace(/\s+/g, ' ');
  
  return formattedCommand;
}

/**
 * 解析并准备执行命令
 * @param response AI生成的响应
 * @returns 准备好执行的命令
 */
export function parseCommandForExecution(response: string): string {
  const extractedCommand = extractCommandFromResponse(response);
  if (!extractedCommand) {
    return '';
  }
  
  return formatCommand(extractedCommand);
} 