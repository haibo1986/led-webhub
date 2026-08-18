# LED WebHub

面向 LED 照明企业的多租户官网、产品资料和询盘管理平台。

## 当前基线

- Next.js 16 App Router + React 19 + TypeScript
- PostgreSQL + Prisma 7
- 企业官网首套“工业编辑感”模板
- 企业管理工作台
- 租户、域名、成员、角色和审计数据模型
- 产品分类、动态参数模板、产品、多 SKU 和中英文内容模型
- 文件公开、受控、内部三种可见性
- 询盘归属与状态流转模型
- JWT HttpOnly Session、RBAC 和租户边界守卫
- 真实登录、退出与会话撤权回查
- 企业设置保存和审计
- 产品新增、编辑、多 SKU、发布、下架和软删除
- 分类模板驱动的 SKU 动态参数矩阵
- 本地开发文件存储、产品附件关联和鉴权下载
- AI 总开关默认关闭；MVP 不含访客侧 AI

## 本地启动

要求 Node.js 20.9+ 和 Docker。

```bash
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

访问：

- 企业官网：<http://localhost:3000>
- 企业后台：<http://localhost:3000/dashboard>

开发种子账号：

- 流明光电管理员：`admin@lumenworks.cn`
- 流明光电编辑：`editor@lumenworks.cn`
- 极光照明管理员：`admin@aurora.cn`
- 演示密码：由 `DEMO_PASSWORD` 环境变量指定；未设置时随机生成并在 seed 输出中打印一次（仅新账号生效，重跑 seed 不会重置已有账号密码）

seed 在生产环境默认拒绝执行（需 `ALLOW_SEED=true` 显式覆盖）。

首次启动前复制 `.env.example` 为 `.env`，并替换 `SESSION_SECRET`。生产环境不得使用示例凭据。

## 安全约束

任何租户业务查询都必须从已验证 Session 获取 `tenantId`，并通过 DAL 或 `tenantScope` 注入查询条件。前端隐藏、URL 参数及路由代理均不能作为唯一授权手段。所有 Server Action 和 Route Handler 需要在靠近数据源的位置重新校验权限。

## 验证命令

```bash
npm run db:validate
npm run lint
npm run build
```

## 下一批开发

1. 产品动态参数模板与规格参数录入
2. 文件上传、引用检查与公开/受控下载
3. 中文和英文独立预览与官网动态渲染
4. 询盘表单、处理状态与邮件提醒
5. Playwright 租户越权及关键流程测试

## 部署与租户路由

公开站租户由请求头解析（`x-forwarded-host` → `host` → `DEFAULT_TENANT_SLUG` 回退）。生产反向代理**必须**强制覆写 `x-forwarded-host`，不得透传客户端值：

- 不覆写：全部流量静默落到默认租户
- 透传客户端值：可伪造该头切换任意已验证域名的公开站（仅公开数据，但可被用于内容伪装）

多实例部署前必须设置 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`（`openssl rand -hex 32`）。公开站 SEO 基础地址用 `NEXT_PUBLIC_SITE_URL` 配置（不设则按请求 host 推导）。
