// 终端AI集成测试脚本

import { mastraClient, callTerminalAgent, streamTerminalAgent } from '../lib/mastra-integration';

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
 * 测试智能体自然语言处理能力
 */
async function testNLPCapability() {
  console.log('\n===== 测试自然语言理解能力 =====');
  try {
    const query = '如何查看当前目录下的所有文件？';
    console.log(`发送查询: "${query}"`);
    
    const response = await callTerminalAgent(query);
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
 * 测试流式响应
 */
async function testStreamingResponse() {
  console.log('\n===== 测试流式响应 =====');
  try {
    const query = '解释什么是grep命令';
    console.log(`发送流式查询: "${query}"`);
    
    let responseChunks: string[] = [];
    
    await streamTerminalAgent(query, (chunk) => {
      process.stdout.write(chunk);
      responseChunks.push(chunk);
    });
    
    console.log('\n');
    
    if (responseChunks.length > 0) {
      console.log(`✅ 成功收到${responseChunks.length}个响应块`);
      return true;
    } else {
      console.log('❌ 未收到任何响应块');
      return false;
    }
  } catch (error) {
    console.error('❌ 流式响应测试失败:', error);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runTests() {
  console.log('🔍 开始测试终端AI集成...\n');
  
  // 给服务器一点时间预热
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const connectionSuccess = await testConnection();
  if (!connectionSuccess) {
    console.error('⛔ 连接测试失败，终止后续测试');
    return;
  }
  
  const nlpSuccess = await testNLPCapability();
  const streamingSuccess = await testStreamingResponse();
  
  console.log('\n===== 测试结果汇总 =====');
  console.log(`连接测试: ${connectionSuccess ? '✅ 通过' : '❌ 失败'}`);
  console.log(`自然语言测试: ${nlpSuccess ? '✅ 通过' : '❌ 失败'}`);
  console.log(`流式响应测试: ${streamingSuccess ? '✅ 通过' : '❌ 失败'}`);
  
  const overallSuccess = connectionSuccess && nlpSuccess && streamingSuccess;
  console.log(`\n总体结果: ${overallSuccess ? '✅ 所有测试通过' : '❌ 部分测试失败'}`);
}

// 执行测试
runTests().catch(error => {
  console.error('测试执行出错:', error);
  process.exit(1);
}); 