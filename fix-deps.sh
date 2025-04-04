#!/bin/bash
# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}====== Hyper 缺失依赖修复脚本 ======${NC}"

# 确保在正确的目录
if [ ! -f "app/index.ts" ]; then
    echo -e "${RED}错误: 当前目录不是 Hyper 项目根目录${NC}"
    echo -e "${YELLOW}请导航到 Hyper 项目根目录后再运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}安装缺失的依赖...${NC}"

# 开发依赖
yarn add --dev \
  electron-fetch \
  electron-is-dev \
  ast-types \
  native-reg \
  electron-store \
  queue \
  node-pty \
  os-locale \
  shell-env \
  native-process-working-directory \
  electron-devtools-installer \
  @types/queue

# 重建node-pty (这对跨平台编译很重要)
echo -e "${YELLOW}重建 node-pty 模块...${NC}"
yarn run rebuild-node-pty

echo -e "${GREEN}依赖安装完成。现在请尝试:${NC}"
echo -e "${YELLOW}终端1: yarn run dev${NC}"
echo -e "${YELLOW}终端2: yarn run app${NC}" 