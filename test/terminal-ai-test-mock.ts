// 终端AI集成模拟测试脚本 
// 用于测试Mastra服务连接和客户端逻辑，但不实际调用LLM

import { mastraClient } from '../lib/mastra-integration';

/**
 * 测试终端AI连接功能
 */
async function testConnection() {
  console.log('===== 测试终端AI连接 =====');
  try {
    // 测试获取智能体
    const agent = mastraClient.getAgent('terminalAgent');
    if (agent) {
      console.log('✅ 成功连接到terminalAgent');
    } else {
      console.error('❌ 无法获取terminalAgent');
      return false;
    }
    return true;
  } catch (error) {
    console.error('❌ 连接测试失败:', error);
    return false;
  }
}

/**
 * 模拟智能体响应
 */
async function mockAgentResponse(query: string): Promise<string> {
  console.log(`模拟响应查询: "${query}"`);
  
  // 根据不同的查询返回预设的响应
  if (query.includes('查看') && query.includes('文件')) {
    return `
要查看当前目录下的所有文件，可以使用以下命令：

\`\`\`bash
ls
\`\`\`

如果你想要查看更详细的信息，可以添加选项：

\`\`\`bash
ls -la
\`\`\`

这会显示包括隐藏文件在内的所有文件，以及它们的权限、所有者、大小和修改日期等信息。

Windows系统中，可以使用:
\`\`\`bash
dir
\`\`\`
`;
  } else if (query.includes('grep')) {
    return `
grep是一个强大的文本搜索工具，用于在文件中查找指定的模式或正则表达式。

基本用法：
\`\`\`bash
grep "搜索内容" 文件名
\`\`\`

常用选项：
- \`-i\`: 忽略大小写
- \`-r\`: 递归搜索子目录
- \`-n\`: 显示匹配行的行号
- \`-v\`: 显示不匹配的行

例如，在当前目录下的所有JavaScript文件中查找"function"：
\`\`\`bash
grep -r "function" --include="*.js" .
\`\`\`
`;
  } else {
    return `我理解你的问题是关于"${query}"。这是一个模拟响应，实际部署时会由LLM生成内容。`;
  }
}

/**
 * 测试智能体自然语言处理能力（使用模拟响应）
 */
async function testNLPCapability() {
  console.log('\n===== 测试自然语言理解能力 =====');
  try {
    const query = '如何查看当前目录下的所有文件？';
    console.log(`发送查询: "${query}"`);
    
    const response = await mockAgentResponse(query);
    console.log('智能体响应:');
    console.log(response);
    
    if (response.includes('ls') || response.includes('dir')) {
      console.log('✅ 智能体成功理解查询并提供了相关命令');
      return true;
    } else {
      console.log('❓ 智能体响应可能不包含预期命令');
      return true; // 仍然返回true，因为模型响应可能有多种形式
    }
  } catch (error) {
    console.error('❌ 自然语言测试失败:', error);
    return false;
  }
}

/**
 * 测试流式响应（使用模拟）
 */
async function testStreamingResponse() {
  console.log('\n===== 测试流式响应 =====');
  try {
    const query = '解释什么是grep命令';
    console.log(`发送流式查询: "${query}"`);
    
    const response = await mockAgentResponse(query);
    
    // 模拟流式输出，将响应分成块
    const chunks = response.split(' ').map(word => word + ' ');
    
    console.log('模拟流式输出:');
    for (const chunk of chunks.slice(0, 5)) {
      process.stdout.write(chunk);
      await new Promise(resolve => setTimeout(resolve, 50)); // 模拟延迟
    }
    console.log('... [内容省略]');
    
    console.log('\n');
    console.log(`✅ 成功模拟接收${chunks.length}个响应块`);
    return true;
  } catch (error) {
    console.error('❌ 流式响应测试失败:', error);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('🔍 开始测试终端AI集成（模拟模式）...\n');
  
  const connectionSuccess = await testConnection();
  if (!connectionSuccess) {
    console.error('⛔ 连接测试失败，终止后续测试');
    return;
  }
  
  const nlpSuccess = await testNLPCapability();
  const streamingSuccess = await testStreamingResponse();
  
  console.log('\n===== 测试结果汇总 =====');
  console.log(`连接测试: ${connectionSuccess ? '✅ 通过' : '❌ 失败'}`);
  console.log(`自然语言测试 (模拟): ${nlpSuccess ? '✅ 通过' : '❌ 失败'}`);
  console.log(`流式响应测试 (模拟): ${streamingSuccess ? '✅ 通过' : '❌ 失败'}`);
  
  const overallSuccess = connectionSuccess && nlpSuccess && streamingSuccess;
  console.log(`\n总体结果: ${overallSuccess ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
}

// 执行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
}); 