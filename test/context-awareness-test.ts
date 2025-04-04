/**
 * 上下文感知功能测试
 */
import * as readline from 'readline';
import {
  getCurrentDirectoryInfo,
  getProjectContext,
  callTerminalAgentWithContext,
  streamTerminalAgentWithContext
} from '../lib/mastra-connector';

// 创建一个唯一的会话ID
const threadId = `context-test-${Date.now()}`;

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * 测试上下文信息获取
 */
async function testContextGathering() {
  console.log('\n===== 测试上下文信息获取 =====');
  
  try {
    console.log('获取当前目录信息...');
    const dirInfo = await getCurrentDirectoryInfo();
    console.log('当前目录:', dirInfo.currentDirectory);
    console.log(`目录中包含 ${dirInfo.files.length} 个文件/文件夹`);
    
    console.log('\n获取项目上下文信息...');
    const projectInfo = await getProjectContext();
    console.log('项目类型:', projectInfo.type);
    if (projectInfo.framework) {
      console.log('框架:', projectInfo.framework);
    }
    console.log('主要语言:', projectInfo.languages);
    
    console.log('\n✅ 上下文信息获取成功');
    return true;
  } catch (error) {
    console.error('❌ 上下文信息获取失败:', error);
    return false;
  }
}

/**
 * 测试上下文感知的智能体调用
 */
async function testContextAwareAgentCall() {
  console.log('\n===== 测试上下文感知的智能体调用 =====');
  
  try {
    // 简单的查询
    const query = '列出当前目录中的所有JavaScript文件';
    console.log(`发送查询: "${query}"`);
    
    console.log('等待智能体响应...');
    const response = await callTerminalAgentWithContext(query, threadId);
    
    console.log('\n智能体响应:');
    console.log('----------------------------------------');
    console.log(response);
    console.log('----------------------------------------');
    
    console.log('\n✅ 上下文感知的智能体调用成功');
    return true;
  } catch (error) {
    console.error('❌ 上下文感知的智能体调用失败:', error);
    return false;
  }
}

/**
 * 测试流式上下文感知的智能体调用
 */
async function testStreamContextAwareAgentCall() {
  console.log('\n===== 测试流式上下文感知的智能体调用 =====');
  
  return new Promise<boolean>((resolve) => {
    try {
      // 复杂一点的查询
      const query = '解释当前项目的目录结构';
      console.log(`发送查询: "${query}"`);
      
      console.log('等待智能体流式响应...');
      console.log('----------------------------------------');
      
      let responseComplete = false;
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (!responseComplete) {
          console.log('----------------------------------------');
          console.error('❌ 流式响应超时');
          resolve(false);
        }
      }, 30000);
      
      streamTerminalAgentWithContext(
        query,
        (chunk) => {
          // 输出每个响应块
          process.stdout.write(chunk);
        },
        threadId
      ).then(() => {
        responseComplete = true;
        clearTimeout(timeout);
        
        console.log('\n----------------------------------------');
        console.log('\n✅ 流式上下文感知的智能体调用成功');
        resolve(true);
      }).catch((error) => {
        responseComplete = true;
        clearTimeout(timeout);
        
        console.log('\n----------------------------------------');
        console.error('❌ 流式上下文感知的智能体调用失败:', error);
        resolve(false);
      });
    } catch (error) {
      console.error('❌ 流式上下文感知的智能体调用错误:', error);
      resolve(false);
    }
  });
}

/**
 * 运行交互式测试
 */
async function runInteractiveTest() {
  console.log('\n===== 运行交互式上下文感知测试 =====');
  
  return new Promise<boolean>((resolve) => {
    const askQuestion = () => {
      rl.question('\n请输入自然语言查询 (输入"exit"退出): ', async (query) => {
        if (query.toLowerCase() === 'exit') {
          console.log('退出交互式测试');
          rl.close();
          resolve(true);
          return;
        }
        
        try {
          console.log('正在处理，请稍候...');
          
          streamTerminalAgentWithContext(
            query,
            (chunk) => {
              // 输出每个响应块
              process.stdout.write(chunk);
            },
            threadId
          ).then(() => {
            askQuestion();
          }).catch((error) => {
            console.error('处理查询失败:', error);
            askQuestion();
          });
        } catch (error) {
          console.error('处理查询出错:', error);
          askQuestion();
        }
      });
    };
    
    askQuestion();
  });
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('开始测试上下文感知功能...');
  
  // 测试上下文信息获取
  const contextGatheringResult = await testContextGathering();
  if (!contextGatheringResult) {
    console.error('上下文信息获取测试失败，终止后续测试');
    process.exit(1);
  }
  
  // 测试上下文感知的智能体调用
  const contextAwareAgentCallResult = await testContextAwareAgentCall();
  if (!contextAwareAgentCallResult) {
    console.error('上下文感知的智能体调用测试失败，终止后续测试');
    process.exit(1);
  }
  
  // 测试流式上下文感知的智能体调用
  const streamContextAwareAgentCallResult = await testStreamContextAwareAgentCall();
  if (!streamContextAwareAgentCallResult) {
    console.error('流式上下文感知的智能体调用测试失败，终止后续测试');
    process.exit(1);
  }
  
  // 运行交互式测试
  console.log('\n是否进行交互式测试? (y/n)');
  rl.question('', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      await runInteractiveTest();
    }
    
    console.log('\n所有测试完成!');
    rl.close();
  });
}

// 运行测试
runTests(); 