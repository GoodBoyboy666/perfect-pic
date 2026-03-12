# 贡献指南 (Contributing Guide)

感谢你对 **Perfect Pic** 的关注！我们非常欢迎任何形式的贡献，无论是修复 Bug、添加新功能，还是改进文档。

本项目是一个包含 Golang 后端和 React 前端的单体仓库 (Monorepo)。为了确保协作顺利，请遵循以下指南。

## 🤝 如何贡献

### 1. 提交 Issue (Reporting Issues)

如果你发现了 Bug 或有好的功能建议，请首先：

- 搜索现有的 [Issues](https://github.com/GoodBoyboy666/perfect-pic/issues)，看看是否已经有人提出。
- 如果没有，请创建一个新的 Issue。请尽量详细描述问题复现步骤、报错日志或功能需求。
- 在标题或标签中注明该问题属于前端 (Web) 还是后端 (Server)。

### 2. 提交 Pull Request (Pull Requests)

如果你想直接修改代码：

1. **Fork** 本仓库到你的 GitHub 账户。
2. **Clone** 你的 Fork 版本到本地：

```bash
git clone https://github.com/你的用户名/perfect-pic.git
```

3. 在 `beta` 分支上创建一个新的开发分支：

```bash
git checkout -b feature/你的新功能 beta
# 或者
git checkout -b fix/修复的问题 beta
```

4. 进行代码修改，并确保通过了所有的本地测试和 Lint 检查。
5. 提交更改（Commit）：
   > 推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，并建议带上作用域 (Scope) 以区分前后端。

```bash
git commit -m "feat(web): 添加了用户头像上传组件"
# 或
git commit -m "fix(api): 修复了数据库连接超时问题"
```

6. 推送（Push）到你的远程仓库：

```bash
git push origin feature/你的新功能
```

7. 在 GitHub 上提交 **Pull Request (PR)** 到 `beta` 分支。

- 请填写 PR 模板中的所有相关信息。
- 我们的团队会尽快进行 Code Review。

## 💻 开发环境指南

本项目由根目录的 **Go** 后端和 `web/` 目录下的 **React** 前端组成。

### 环境依赖

- **后端**: Go 1.25+
- **前端**: Node.js 24+, pnpm 10+
- **数据库**: SQLite / MySQL / PostgreSQL (根据你的本地配置)

### 目录结构说明

- `/` (根目录): 后端 Go 代码及全局配置文件。
- `/web`: 前端 React (Vite) 代码及 UI 资源。

### 本地运行步骤

建议开启两个终端窗口分别运行前后端服务：

**终端 1: 启动后端 API。**

```bash
# 下载 Go 依赖
go mod download

# 运行后端服务
go run main.go
```

**终端 2: 启动前端页面。**

```bash
# 进入前端目录
cd web

# 下载 Node 依赖
pnpm install

# 启动 Vite 开发服务器
pnpm run dev
```

### 本地编译构建

如果你需要构建用于生产环境的单体可执行文件（包含内嵌的前端静态资源），我们在根目录提供了一键构建脚本：

```bash
# 运行交互式构建脚本
./scripts/build.sh
```

### 代码规范与检查

提交代码前，请确保符合以下代码风格：

- **后端**: 使用 `gofmt` 或 `goimports` 格式化代码，并建议在本地运行 `golangci-lint` 检查潜在问题。
- **前端**: 在 `web/` 目录下运行 `pnpm check` 以通过 ESLint 和 Type 检查。PR 提交后，GitHub Actions 会自动对 `web/` 目录的变更进行风格拦截。

## 📜 行为准则 (Code of Conduct)

请保持友好、尊重和包容。我们希望构建一个积极的开源社区。

## 📄 许可证

参与本项目即表示你同意你的贡献将遵循项目的 [LICENSE](https://www.google.com/search?q=LICENSE) 协议。
