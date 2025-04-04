#!/bin/bash

# 启动Hyper和Mastra服务的脚本

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}启动Hyper终端与Mastra智能体集成环境${NC}"
echo -e "${YELLOW}===========================================${NC}"

# 检查是否存在hyperai目录
if [ ! -d "./hyperai" ]; then
  echo -e "${RED}错误: hyperai目录不存在${NC}"
  echo -e "请确保已运行 'npx create-mastra@latest' 创建hyperai项目"
  exit 1
fi

# 启动Mastra服务
echo -e "${GREEN}启动Mastra服务...${NC}"
cd hyperai && npm run dev &
MASTRA_PID=$!

# 等待Mastra服务启动
echo -e "${YELLOW}等待Mastra服务启动...${NC}"
sleep 5

# 启动Hyper
echo -e "${GREEN}启动Hyper终端...${NC}"
cd .. && yarn run dev &
HYPER_DEV_PID=$!

# 启动应用
echo -e "${GREEN}启动Hyper应用...${NC}"
yarn run app &
HYPER_APP_PID=$!

# 捕获SIGINT信号(Ctrl+C)，确保关闭所有进程
trap "echo -e '${YELLOW}正在关闭所有进程...${NC}'; kill $MASTRA_PID $HYPER_DEV_PID $HYPER_APP_PID 2>/dev/null; exit" SIGINT

# 等待用户按下Ctrl+C
echo -e "${BLUE}环境已启动${NC}"
echo -e "${YELLOW}------------------------------------------${NC}"
echo -e "Mastra服务运行在: ${GREEN}http://localhost:4111${NC}"
echo -e "按 ${RED}Ctrl+C${NC} 停止所有服务"
echo -e "${YELLOW}------------------------------------------${NC}"

# 保持脚本运行
wait