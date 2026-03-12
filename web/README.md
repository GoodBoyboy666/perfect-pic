# Perfect Pic Web

Perfect Pic Web 是 [Perfect Pic](https://github.com/GoodBoyboy666/perfect-pic) 项目的前端实现。这是一个基于现代 Web 技术栈构建的图片管理系统前端，提供了用户画廊、上传功能以及完整的后台管理界面。本项目由AI编写。

## ✨ 特性

- **现代技术栈**: 使用 React 19, Vite, Tailwind CSS 4 和 TanStack Router 构建。
- **精美 UI**: 基于 Radix UI 和 Shadcn UI 的组件设计，支持暗色模式。
- **用户功能**:
  - 🔐 安全的身份验证（登录/注册）
  - 📊 用户个人仪表盘
  - 🖼️ 图片画廊展示与管理
  - 📤 便捷的图片上传功能
  - 👤 个人资料设置
- **管理员功能**:
  - ⚡ 管理员概览面板
  - 👥 用户管理
  - 🖼️ 全局图片管理
  - ⚙️ 系统设置
- **完全响应式**: 适配移动端和桌面端访问。

## 🛠️ 技术栈

- **核心框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **路由管理**: [TanStack Router](https://tanstack.com/router)
- **样式方案**: [Tailwind CSS v4](https://tailwindcss.com/) + `tailwindcss-animate`
- **UI 组件**: [Radix UI](https://www.radix-ui.com/) (Headless Components)
- **HTTP 客户端**: [Axios](https://axios-http.com/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **测试框架**: [Vitest](https://vitest.dev/) + React Testing Library
- **代码规范**: ESLint + Prettier

## 🚀 快速开始

### 环境要求

- Node.js (推荐 v22 或更高版本)
- pnpm

### 安装

1. 克隆仓库

   ```bash
   git clone https://github.com/GoodBoyboy666/perfect-pic.git
   cd web
   ```

2. 安装依赖

   ```bash
   pnpm install
   ```

3. 启动开发服务器

   ```bash
   pnpm dev
   ```

   应用将在 `http://localhost:3000` 启动。

### 构建生产版本

构建用于生产环境的静态文件：

```bash
pnpm build
```

构建产物将输出到 `dist` 目录。您可以将该目录部署到任何静态网站托管服务（如 Vercel, Netlify, Nginx 等）。

### 代码质量检查

- **运行测试**:

  ```bash
  pnpm test
  ```

- **Lint 检查**:

  ```bash
  pnpm check
  ```

- **代码格式化**:

  ```bash
  pnpm fix
  ```

## 📂 目录结构

```text
src/
├── components/       # 公共组件
│   └── ui/           # 基础 UI 组件 (Buttons, Inputs, Dialogs 等)
├── context/          # 全局状态管理 (AuthContext, SiteContext)
├── hooks/            # 自定义 React Hooks
├── lib/              # 工具函数与 API 配置
├── routes/           # 页面路由 (基于文件系统的路由结构)
│   ├── _admin/       # 管理后台路由组
│   │   └── admin/    # 管理后台页面 (Overview, Images, Users, Settings)
│   ├── _user/        # 用户中心路由组
│   │   └── dashboard/# 用户中心页面 (Overview, Gallery, Upload, Profile)
│   ├── __root.tsx    # 根路由布局
│   ├── _admin.tsx    # 管理后台布局 (CheckAuth, Sidebar)
│   ├── _user.tsx     # 用户中心布局 (CheckAuth, Sidebar)
│   ├── index.tsx     # 首页
│   ├── init.tsx      # 系统初始化/安装页面
│   ├── login.tsx     # 登录页
│   └── register.tsx  # 注册页
├── main.tsx          # 应用入口
├── styles.css        # 全局样式
└── routeTree.gen.ts  # TanStack Router 自动生成的路由树
```

## 📄 许可证

[MIT License](LICENSE)
