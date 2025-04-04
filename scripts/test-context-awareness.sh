#!/bin/bash

# 设置脚本严格模式
set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}开始上下文感知功能测试...${NC}"

# 确保Mastra服务已启动
echo -e "${BLUE}检查Mastra服务状态...${NC}"
if ! curl -s http://localhost:4111/api/health > /dev/null; then
  echo -e "${RED}Mastra服务未运行，请先启动Mastra服务!${NC}"
  echo -e "${BLUE}可以使用以下命令启动:${NC} yarn start:terminal-ai"
  exit 1
fi

echo -e "${GREEN}Mastra服务已启动√${NC}"

# 检查终端智能体是否已注册
echo -e "${BLUE}检查终端智能体注册状态...${NC}"
RESPONSE=$(curl -s http://localhost:4111/api/agents)
if ! echo "$RESPONSE" | grep -q "terminalAgent"; then
  echo -e "${RED}终端智能体未注册，请先启动Mastra服务并注册智能体!${NC}"
  exit 1
fi

echo -e "${GREEN}终端智能体已注册√${NC}"

# 运行TypeScript测试
echo -e "${BLUE}运行上下文感知测试...${NC}"
npx ts-node test/context-awareness-test.ts

echo -e "${GREEN}测试完成!${NC}" 