#!/bin/bash

# 启动Hyper终端与Mastra智能体的脚本
# 优先启动hyperai服务

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}启动AI智能终端环境${NC}"
echo -e "${YELLOW}===========================================${NC}"

# 获取当前脚本所在目录的父目录（项目根目录）
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
echo -e "项目根目录: ${PROJECT_ROOT}"

# 检查hyperai目录是否存在
if [ ! -d "${PROJECT_ROOT}/hyperai" ]; then
  echo -e "${RED}错误: hyperai目录不存在${NC}"
  echo -e "请确保hyperai项目在正确的位置 (${PROJECT_ROOT}/hyperai)"
  exit 1
fi

# 1. 首先启动Mastra服务
echo -e "${GREEN}Step 1: 启动Mastra服务...${NC}"
cd "${PROJECT_ROOT}/hyperai" && npm run dev &
MASTRA_PID=$!

# 检查Mastra服务是否成功启动
echo -e "${YELLOW}等待Mastra服务启动...${NC}"
sleep 3

# 检查服务是否可用
MAX_ATTEMPTS=10
ATTEMPTS=0
SERVICE_READY=false

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  ATTEMPTS=$((ATTEMPTS+1))
  echo -e "检查Mastra服务 (尝试 ${ATTEMPTS}/${MAX_ATTEMPTS})..."
  
  if curl -s "http://localhost:4111/api/agents" > /dev/null; then
    SERVICE_READY=true
    echo -e "${GREEN}✓ Mastra服务已成功启动${NC}"
    break
  else
    echo -e "${YELLOW}Mastra服务尚未准备就绪，等待...${NC}"
    sleep 2
  fi
done

if [ "$SERVICE_READY" = false ]; then
  echo -e "${RED}❌ 无法连接到Mastra服务，请检查日志${NC}"
  echo -e "终止进程 $MASTRA_PID"
  kill $MASTRA_PID 2>/dev/null
  exit 1
fi

# 2. 启动Hyper终端开发环境
echo -e "${GREEN}Step 2: 启动Hyper终端开发环境...${NC}"
cd "${PROJECT_ROOT}" && yarn run dev &
HYPER_DEV_PID=$!

# 3. 启动Hyper应用
echo -e "${GREEN}Step 3: 启动Hyper应用...${NC}"
sleep 3
cd "${PROJECT_ROOT}" && yarn run app &
HYPER_APP_PID=$!

# 捕获SIGINT信号(Ctrl+C)，确保关闭所有进程
trap "echo -e '${YELLOW}正在关闭所有进程...${NC}'; kill $MASTRA_PID $HYPER_DEV_PID $HYPER_APP_PID 2>/dev/null; exit" INT TERM

# 等待用户按下Ctrl+C
echo -e "${BLUE}环境已启动${NC}"
echo -e "${YELLOW}------------------------------------------${NC}"
echo -e "Mastra服务运行在: ${GREEN}http://localhost:4111${NC}"
echo -e "按 ${RED}Ctrl+C${NC} 停止所有服务"
echo -e "${YELLOW}------------------------------------------${NC}"

# 保持脚本运行
wait 