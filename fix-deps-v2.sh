#!/bin/bash
# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}====== Hyper 缺失依赖修复脚本 V2 ======${NC}"

# 确保在正确的目录
if [ ! -f "app/index.ts" ]; then
    echo -e "${RED}错误: 当前目录不是 Hyper 项目根目录${NC}"
    echo -e "${YELLOW}请导航到 Hyper 项目根目录后再运行此脚本${NC}"
    exit 1
fi

echo -e "${YELLOW}清理node_modules...${NC}"
rm -rf node_modules
rm -rf app/node_modules

echo -e "${YELLOW}删除yarn.lock重新生成...${NC}"
rm -f yarn.lock

echo -e "${YELLOW}安装依赖...${NC}"
yarn

echo -e "${YELLOW}安装缺失的依赖（指定版本）...${NC}"

# 开发依赖 - 指定版本
yarn add --dev \
  electron-fetch@1.7.4 \
  electron-is-dev@2.0.0 \
  ast-types@0.15.2 \
  native-reg@1.1.1 \
  electron-store@8.1.0 \
  queue@6.0.2 \
  node-pty@0.10.1 \
  os-locale@5.0.0 \
  shell-env@4.0.1 \
  native-process-working-directory@1.0.0 \
  electron-devtools-installer@3.2.0

# 类型定义
echo -e "${YELLOW}安装缺失的类型定义...${NC}"
yarn add --dev \
  @types/electron-fetch \
  @types/electron-is-dev \
  @types/ast-types \
  @types/native-reg \
  @types/electron-store \
  @types/queue \
  @types/node-pty \
  @types/os-locale \
  @types/shell-env \
  @types/native-process-working-directory \
  @types/react@18.2.79 \
  @types/react-dom@18.2.25

# 更新构建
echo -e "${YELLOW}强制重新构建...${NC}"
rm -rf target
rm -rf app/target

# 重建node-pty (这对跨平台编译很重要)
echo -e "${YELLOW}重建 node-pty 模块...${NC}"
yarn run rebuild-node-pty

echo -e "${GREEN}请尝试重新构建和启动:${NC}"
echo -e "${YELLOW}终端1: yarn run dev${NC}"
echo -e "${YELLOW}终端2: yarn run app${NC}" 