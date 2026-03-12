#!/bin/bash

# 设置脚本在遇到错误时退出
set -e

# 进入项目根目录 (假设脚本在 scripts/ 目录下)
cd "$(dirname "$0")/.."

echo -e "\033[36m=========================================="
echo -e "    🛠️  Perfect Pic 构建脚本  📦"
echo -e "==========================================\033[0m"

# 0. 选择构建类型与目标平台
echo -e "\n\033[33m[Step] ⚙️ 选择构建参数...\033[0m"

BUILD_EMBED=false
read -p "  👉 是否构建 Embed 版本? (y/N) [默认 N]: " EMBED_INPUT
EMBED_INPUT=${EMBED_INPUT:-N}
if [[ "$EMBED_INPUT" =~ ^[Yy]$ ]]; then
    BUILD_EMBED=true
fi

TARGET_OS=""
while [ -z "$TARGET_OS" ]; do
    echo "  请选择目标平台:"
    echo "    1) linux"
    echo "    2) windows"
    echo "    3) darwin"
    read -p "  👉 输入序号或名称 [默认 1]: " OS_INPUT
    OS_INPUT=${OS_INPUT:-1}
    case "$OS_INPUT" in
        1|linux|LINUX) TARGET_OS="linux" ;;
        2|windows|WINDOWS|win|WIN) TARGET_OS="windows" ;;
        3|darwin|DARWIN|mac|MAC|macos|MACOS) TARGET_OS="darwin" ;;
        *) echo -e "  \033[31m❌ 无效平台选择，请重试。\033[0m" ;;
    esac
done

TARGET_ARCH=""
while [ -z "$TARGET_ARCH" ]; do
    echo "  请选择 CPU 架构:"
    echo "    1) amd64"
    echo "    2) arm64"
    read -p "  👉 输入序号或名称 [默认 1]: " ARCH_INPUT
    ARCH_INPUT=${ARCH_INPUT:-1}
    case "$ARCH_INPUT" in
        1|amd64|AMD64|x86_64|X86_64) TARGET_ARCH="amd64" ;;
        2|arm64|ARM64|aarch64|AARCH64) TARGET_ARCH="arm64" ;;
        *) echo -e "  \033[31m❌ 无效架构选择，请重试。\033[0m" ;;
    esac
done

echo -e "\n\033[36m构建配置:\033[0m"
echo "  Embed: $BUILD_EMBED"
echo "  OS/ARCH: $TARGET_OS/$TARGET_ARCH"

# 1. 检查环境
echo -e "\n\033[33m[Step] 🔍 正在检查环境...\033[0m"

check_command() {
    local cmd="$1"
    local name="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        local ver=""
        if [ "$cmd" = "go" ]; then
            ver=$("$cmd" version | head -n 1)
        else
            ver=$("$cmd" --version | head -n 1)
        fi
        echo -e "  [✅] $name 已安装 ($ver)"
        return 0
    else
        echo -e "  [❌] $name 未找到，请先安装。"
        return 1
    fi
}

ENV_OK=true
check_command go "Go" || ENV_OK=false
if [ "$BUILD_EMBED" = true ]; then
    check_command node "Node.js" || ENV_OK=false
    check_command pnpm "pnpm" || ENV_OK=false
fi

if ! command -v git >/dev/null 2>&1; then
    echo -e "  [❌] Git 未找到 (脚本依赖 Git 操作)"
    ENV_OK=false
fi

if [ "$ENV_OK" = false ]; then
    echo -e "\n\033[31m❌ 环境检查失败，请安装缺失的依赖后重试。\033[0m"
    exit 1
fi

# 2. 获取构建版本
echo -e "\n\033[33m[Step] 🏷️  获取构建版本信息...\033[0m"

# 尝试获取当前 commit 的 exact tag
if CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null); then
    BUILD_VERSION=$CURRENT_TAG
    echo -e "  ✅ 检测到当前 commit 存在 tag: \033[32m$BUILD_VERSION\033[0m"
else
    # 使用 git describe --tags --always --dirty
    BUILD_VERSION=$(git describe --tags --always --dirty)
    echo -e "  ℹ️  当前 commit 无 tag，生成版本: \033[32m$BUILD_VERSION\033[0m"
fi

BUILD_TIME=$(date '+%Y-%m-%d_%H:%M:%S')
GIT_COMMIT=$(git rev-parse HEAD)

echo "  📌 构建版本: $BUILD_VERSION"
echo "  🕒 构建时间: $BUILD_TIME"
echo "  🔖 Git Hash: $GIT_COMMIT"

# 3. 前端流程 (仅 Embed 版)
if [ "$BUILD_EMBED" = true ]; then
    echo -e "\n\033[33m[Step] 🏗️  编译本地前端...\033[0m"
    
    # 进入单体仓库的前端目录
    cd web

    # 注入全局变量（UI Hash 直接使用当前 Git Commit）
    export VITE_APP_VERSION="$BUILD_VERSION"
    export VITE_UI_HASH="$GIT_COMMIT"
    export VITE_BUILD_TIME="$BUILD_TIME"

    echo "  📦 使用 pnpm 安装依赖..."
    pnpm install --frozen-lockfile
    echo "  🔨 使用 pnpm 构建..."
    pnpm build

    cd ..

    echo -e "\n\033[33m[Step] 📋 准备前端静态资源...\033[0m"
    FRONTEND_DEST="frontend"

    # 安全清理并创建目录
    mkdir -p "$FRONTEND_DEST"
    rm -rf "${FRONTEND_DEST:?}/"*

    # 拷贝产物供 Go Embed 使用
    cp -r web/dist/* "$FRONTEND_DEST/"
    touch "$FRONTEND_DEST/.keep"
    echo -e "  ✅ 前端产物已嵌入 $FRONTEND_DEST 目录"
else
    echo -e "\n\033[33m[Step] 📦 非 Embed 版本，跳过前端构建...\033[0m"
fi

# 4. 编译后端
echo -e "\n\033[33m[Step] 🚀 编译后端...\033[0m"

LDFLAGS_COMMON="-s -w -X 'main.AppVersion=$BUILD_VERSION' -X 'main.BuildTime=$BUILD_TIME' -X 'main.GitCommit=$GIT_COMMIT'"
BUILD_TAGS=""
OUTPUT_DIR="bin"
mkdir -p "$OUTPUT_DIR"

if [ "$BUILD_EMBED" = true ]; then
    # Embed 模式下，FrontendVer 也直接使用全局 Git Commit
    LDFLAGS="$LDFLAGS_COMMON -X 'main.FrontendVer=$GIT_COMMIT'"
    BUILD_TAGS="-tags embed"
    OUTPUT_NAME="perfect-pic-$BUILD_VERSION-embed-$TARGET_OS-$TARGET_ARCH"
else
    LDFLAGS="$LDFLAGS_COMMON"
    OUTPUT_NAME="perfect-pic-$BUILD_VERSION-$TARGET_OS-$TARGET_ARCH"
fi

if [ "$TARGET_OS" = "windows" ]; then
    OUTPUT_NAME="${OUTPUT_NAME}.exe"
fi

echo "  目标产物: $OUTPUT_NAME"
export CGO_ENABLED=0

GOOS="$TARGET_OS" GOARCH="$TARGET_ARCH" go build $BUILD_TAGS -ldflags "$LDFLAGS" -o "$OUTPUT_DIR/$OUTPUT_NAME" .

echo -e "  \033[32m✅ 后端构建成功!\033[0m"

# 5. 完成
echo -e "\n\033[32m[Done] 🎉 构建完成!\033[0m"
echo -e "  📂 产物位置: \033[36m$OUTPUT_DIR\033[0m"

# 为非 Windows 产物添加执行权限
if [ "$TARGET_OS" != "windows" ]; then
    chmod +x "$OUTPUT_DIR/$OUTPUT_NAME"
fi
