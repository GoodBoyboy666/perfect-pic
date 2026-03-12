# 定义全局 ARG，供所有构建阶段使用
ARG APP_VERSION="v0.0.0-docker"
ARG BUILD_TIME="unknown"
ARG GIT_COMMIT="unknown"

# ==========================================
# 第一阶段：构建前端
# ==========================================

FROM node:20-alpine AS frontend-builder

# 引入全局 ARG
ARG APP_VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

WORKDIR /web

# 启用 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 复制依赖配置文件
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制前端的所有源码
COPY web/ ./

# 设置 Vite 构建所需的环境变量
# 直接使用当前仓库的 GIT_COMMIT 作为前端的 Hash
ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_BUILD_TIME=${BUILD_TIME}
ENV VITE_UI_HASH=${GIT_COMMIT}

# 构建前端产物 (默认输出到 /web/dist)
RUN pnpm build

# ==========================================
# 第二阶段：构建后端
# ==========================================

FROM golang:1.25-alpine AS backend-builder

WORKDIR /app

# 引入全局 ARG
ARG APP_VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

# 安装 git (为了下载依赖)
RUN apk add --no-cache git

# 先复制 go.mod 和 go.sum 以利用层缓存
COPY go.mod go.sum ./
RUN go mod download
RUN go install github.com/google/wire/cmd/wire@v0.7.0

# 复制后端源码
COPY . .

# 生成依赖注入代码
RUN /go/bin/wire ./internal/di

# 复制构建好的前端资源
COPY --from=frontend-builder /web/dist ./frontend

# 构建后端
# 使用 -tags embed 启用嵌入功能
# 从文件可以直接读取前端版本号注入到 ldflags 中
RUN CGO_ENABLED=0 GOOS=linux go build \
    -tags embed \
    -ldflags "-s -w \
    -X 'main.AppVersion=${APP_VERSION}' \
    -X 'main.BuildTime=${BUILD_TIME}' \
    -X 'main.GitCommit=${GIT_COMMIT}' \
    -X 'main.FrontendVer=${GIT_COMMIT}'" \
    -o perfect-pic .

# ==========================================
# 第三阶段：最终运行时镜像
# ==========================================

FROM alpine:latest

WORKDIR /app

# 安装时区数据和 CA 证书
RUN apk add --no-cache tzdata ca-certificates

# 从构建阶段复制二进制文件
COPY --from=backend-builder /app/perfect-pic .

# 创建常用目录
RUN mkdir -p /data/config /data/database /app/uploads/imgs /app/uploads/avatars

ENV PERFECT_PIC_DATABASE_FILENAME=/data/database/perfect_pic.db

# 暴露默认端口
EXPOSE 8080

# 运行
ENTRYPOINT ["./perfect-pic", "--config-dir", "/data/config"]
