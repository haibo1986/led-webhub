# led-webhub 系统性代码分析报告（2026-08-18）

> **修复状态更新（2026-08-18 晚）**：第一批上线阻断项已修复并验证通过——#1（产品保存级联清空参数值，改 diff 式变体更新）、#3（凭据管理：登录页明文账号已删、seed 不再重置密码+随机演示密码+生产保护、登录限流 5 次/15 分钟）、#4（资产下载改用 getValidatedSession 查 DB，401/403 区分）、#5（唯一约束预检+P2002 捕获+SKU 去重+6 个页面 duplicate 提示）。**#2（next 升级）已完成**：next 16.3.1 + eslint-config-next 16.3.1，npm audit 14→3（剩余 3 个 high 为 prisma CLI 工具链的 deepmerge-ts，dev 期传递依赖，无安全修复版本，force 修复需破坏性升级故暂缓）。期间修复构建环境：WSL 缺 lightningcss Linux 二进制（已补装）；--no-bin-links 导致 .bin/next/.bin/prisma 执行壳丢失（已按 Windows npm 原样重建）。
>
> **第二批（PRD 功能缺口）已完成并验证（tsc/lint/build 全绿）**：#8 SEO 基础设施——proxy.ts（语言段落→x-locale 头+cookie，后台/登录/API noindex）、sitemap.ts（按 host 租户隔离+双语+lastModified）、robots.ts、11 个公开页 generateMetadata（标题/描述/hreflang/canonical）、[locale] layout title.template+metadataBase、根 layout 动态 lang；#9 产品搜索（名称/卖点/描述模糊匹配）+ 分页（12 条/页）；#7 产品详情页询盘表单（productId 写入带租户校验、安全回跳防开放重定向、蜜罐）——**邮件提醒暂缓**（需新依赖+新模型，属确认项）；#6 平台运营后台 M1（platform:manage 权限收敛、租户列表/开通/停用页面与 actions、侧边栏入口）。附带修复：#10（getPublicTenant 加 React cache）、#39（generateMetadata 缺数据时 notFound）。
>
> **第三批（工程债）已完成并验证（tsc/lint/build 全绿）**：A 安全类——#12 安全响应头（X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy，poweredByHeader 关闭）、#13 询盘限流（IP+邮箱 3 次/小时）、#15 文件名 CR/LF 清洗 + mimeType 扩展名白名单 + 图片/PDF 魔数校验、#27 jwtVerify 固定 HS256、#33 上传 Origin 校验、#14 代理头部署约定写入 README 与代码注释、#24 加密密钥/SEO 地址入 .env.example；B 性能类——#16 询盘分页（20 条/页）+ 状态筛选 Tab、#17 news/projects 列表 select 收敛、#18 参数保存 900 次往返 → 3 次批量写入、#30 db.ts globalThis 单例、#31 下载改流式；C 一致性——#19 news/projects update 补审计日志（同事务）、#20 tenantScope 落地（死代码启用）+ requireTenant 死代码删除、#29 权限不足重定向工作台提示（不再 500）、#32 全部 action 位置参数运行时 zod、#34 删除按钮 confirm 确认（ConfirmForm 客户端组件）、#35 语言切换保留 searchParams、#36 计数口径按当前语言发布过滤、#37 update 分类补 isActive、#46 seed 域名 upsert 不再重挂 hostname；D 卫生——#21 [locale] not-found/error/loading 三件套、#23 docker-compose 密码环境变量注入、#28 死代码清理、#38 魔法数字提常量、#40 zod v4 新式 z.email()、#44 error.log 入 .gitignore、安全不变量写入项目 CLAUDE.md、news/projects actions 重写为多行格式。#41 Turbopack 切换**已回退**（WSL+/mnt/e 无开发者模式无法创建符号链接，属环境限制，需 Windows 开启开发者模式后重试）。

> 范围：led-webhub 全部手写源码（src 74 文件 / 约 3 万行）+ prisma/schema.prisma、seed.ts、6 个配置文件。
> 方法：四条线并行——① PRD V1.1 全文对照（22 章 929 段）② Next 16 约定 + 安全审计（对照 node_modules/next/dist/docs/ 本地文档）③ 九维代码审计（dashboard 23 文件 + 公开站 16 文件，2 个专家 agent 独立执行）④ 主 agent 复核（schema/seed/配置/核心库 + npm audit + 全库模式扫描）。全程只读，未修改任何文件。
> 格式：严重/中等/轻微三级，每条五字段：位置 / 问题 / 影响 / 修复建议 / 置信度。

## Codex 参与情况（诊断块）

**Codex unavailable — manual analysis.** 九维审计原计划由 Codex (gpt-5.6-sol) 执行，3 次调用全部超时（570s/900s/600s，覆盖 high/medium effort 与 10/5/2 文件规模），按 cc-suite 规则转人工兜底（由专家 agent + 主 agent 完成同等九维覆盖，质量标准一致）。
- codex-cli registration：missing（无 .mcp.json；本项目走 CLI runner 直连，不受影响）
- codex binary on PATH：yes — /home/haibo/.npm-global/bin/codex（0.147.0，认证正常，7 模型可用）
- Suggested fix：`/cc-suite:diagnose`；重试前检查网络与服务端负载
- 3 次超时 jobId：audit-msxu7v1e-5tsm72 / audit-msxum14a-5k5c4c / audit-msxvnfyz-ktyxth

## 项目现状总评

这是一个「**工程纪律优秀、产品完成度约一半**」的项目。技术内核质量高：Next 16 破坏性变更全部正确落地、租户隔离与鉴权纪律严格（未发现 IDOR）、输入校验全面、无 XSS/注入面——表明作者功底扎实。但存在 1 个静默数据丢失的 Critical bug、凭据管理与框架版本两条高危安全债，以及 PRD 定义的多个 P0 功能缺口（平台运营后台、询盘闭环、筛选搜索、SEO）。当前状态是「高质量的单租户内容站内核 + 未走通的多租户 SaaS 运营闭环」。建议先修上线阻断项（数据丢失 + next 升级 + 凭据管理），再补 PRD 功能与测试基建（当前零测试、零 CI）。

---

## 严重问题（11 条）

| # | 位置 | 问题 | 影响 | 修复建议 | 置信度 |
|---|---|---|---|---|---|
| 1 | `src/app/dashboard/products/actions.ts:31` | **[Critical]** `updateProductAction` 每次保存先 `productVariant.deleteMany` 再按 SKU 列表全量重建；因 `VariantParameterValue.variant` 级联删除，**即使只改产品名称，全部 SKU 参数值也被静默清空**，变体 ID 全部更换 | 官网规格矩阵、参数页数据归零且无任何报错，属静默数据丢失 | 改 diff 式更新：按 SKU 集合比对，仅删被移除的变体，未变的保留原 ID；或删除前迁移参数值 | 高（agent 独立验证级联链） |
| 2 | `package.json`（next 16.2.10） | next 框架本身含 **2 个官方高危公告**：① Server Actions DoS（GHSA-m99w-x7hq-7vfj）② App Router 代理绕过（GHSA-6gpp-xcg3-4w24，本项目用 webpack 部分缓解） | 生产环境可被拒绝服务/绕过防护 | 升级 next ≥16.2.11（npm audit 给出 16.3.1 修复版本）；连同 postcss/sharp 等 14 个漏洞一并 `npm update` | 高（npm audit 实测） |
| 3 | `src/app/login/page.tsx:14` + `prisma/seed.ts:20` + `src/app/login/actions.ts:11-23` | 凭据管理三合一：登录页**明文展示有效演示账号**；seed 每次运行把用户密码**重置为公开密码** `WebHub2026!`；登录**无限流无限次尝试** | 生产环境一旦跑过 seed，任何人访问 /login 即可获得有效管理账号并可暴力破解 | 移除页面明文凭据；seed 仅 `create` 时写密码 + 生产环境保护；登录加 IP/账号维度限速与失败锁定 | 高（三个 agent 独立确认） |
| 4 | `src/app/api/assets/[id]/route.ts:10` | 资产下载路由只验 JWT 内 `tenantId`，**不查 DB**（用户停用/租户停用不生效）；dashboard 页面均经 `requireSession()` DB 重查，此路由是例外 | 停用用户/租户在 token 有效期内（最长 8h）仍可下载 CONTROLLED/INTERNAL 资产；与登录页「会话立即失效」承诺不符 | 改用 `requireSession()`（DB 重查）；长期引入 token 版本号/DB 会话实现主动吊销 | 高 |
| 5 | `news/actions.ts:12-13`、`projects/actions.ts:12-13`、`products/actions.ts:20,31` | slug/model/SKU 有唯一约束但**无预检、无 P2002 捕获** | 重复提交（含 SKU 列表内重复项）直接 500，用户体验差 | 预查重复项或捕获 P2002 后 redirect 带错误参数；SKU 列表先 Set 去重 | 高 |
| 6 | 项目级（无对应文件） | **平台运营后台整体缺失**：PRD 12 章 P0（租户开通/停用、初始管理员、域名验证、模板分配、平台审计查看）无任何 UI/action | 多租户 SaaS 运营闭环无法走通；租户/模板/域名只能靠 seed 和直接改库 | 立项补平台后台（Schema 层 Tenant/Domain/Membership 已可支撑） | 高（PRD 逐章对照） |
| 7 | 项目级 | **询盘闭环断链**：产品详情页无询盘入口；`Inquiry.productId` 从不写入；无邮件提醒（无邮件库/模型） | PRD 3.2 MVP 退出条件不满足，对外获客主链路断裂 | 产品页补询盘表单并写 productId；引入邮件通知（含通知/邮件日志模型） | 高 |
| 8 | 11/12 个页面类 + 无 sitemap/robots | **SEO 基础设施为零**：仅 products/[slug] 有 generateMetadata；无 sitemap.ts/robots.ts/hreflang/canonical/后台 noindex | PRD 上线门槛 AC-11 必然失败；多语言站 SEO 完全依赖默认抓取 | 各页补 generateMetadata（含 hreflang alternates）；加 sitemap.ts/robots.ts | 高（公开站 agent 逐页核对） |
| 9 | 项目级 | **产品筛选未兑现**（PRD 4.3）：仅分类筛选；isFilterable 参数无筛选 UI；无关键词搜索；无分页 | 产品价值主张「分类、参数模板、筛选和资料下载」只兑现了资料下载 | 补参数筛选 UI、搜索、分页（数据层 isFilterable 已就绪） | 高 |
| 10 | `src/lib/public-site.ts:10` | `getPublicTenant()` 无 `React.cache()`：layout + page + generateMetadata 每请求查 2-3 次同一租户；全站动态渲染（headers() 所致）且无任何缓存层 | 每次页面渲染多 1-2 次 DB 往返，流量放大后数据库压力线性增长 | `export const getPublicTenant = cache(...)`；内容查询加 unstable_cache 短 TTL 或开启 cacheComponents | 中高（代码路径确认，未实测压测） |
| 11 | `src/app/[locale]/products/page.tsx:10` | 产品列表**无分页无 take**，全量加载并 include 全部 variants + _count.assets | 数据增长后首屏与内存持续恶化 | cursor 分页 + variants 限 take + select 收敛列 | 高 |

## 中等问题（15 条）

| # | 位置 | 问题 | 影响 | 修复建议 | 置信度 |
|---|---|---|---|---|---|
| 12 | `next.config.ts:4-6` | 无安全响应头（X-Frame-Options/CSP/Referrer-Policy），poweredByHeader 未关闭 | 后台可被点击劫持；未来任何 XSS 影响被放大 | `headers()` 配置安全头 | 高 |
| 13 | `src/app/[locale]/contact/actions.ts` | 询盘仅蜜罐防护，无频率限制 | 脚本可刷库灌垃圾询盘 | IP/邮箱滑动窗口限流 | 高 |
| 14 | `src/lib/public-site.ts:12` | 直接信任 `x-forwarded-host` 解析租户 | 代理未强制覆写该头时，客户端可指定头切换公开站（仅公开数据，可用于内容伪装/钓鱼） | 文档化代理约定；不信任时回退 host | 中 |
| 15 | `api/assets/[id]/route.ts:11`、`api/products/[id]/assets/route.ts` | fileName 未剥离 CR/LF（响应头注入风险）；mimeType 信任客户端声明；无魔数校验 | 响应头注入（低概率）；恶意文件伪装扩展名上传 | 上传时清洗 fileName；mimeType 按扩展名白名单映射；图片加魔数检测 | 中 |
| 16 | `src/app/dashboard/inquiries/page.tsx:3` | 询盘列表 take:100 封顶且无分页/筛选 | 超 100 条后旧询盘永久不可达 | 分页 + 状态筛选 Tab | 高 |
| 17 | `dashboard/news/page.tsx:2`、`projects/page.tsx:7` | 列表 include 全文翻译（body/description）仅用于显示标题状态 | RSC payload 浪费 | select 仅取所需字段 | 高 |
| 18 | `dashboard/products/[id]/parameters/actions.ts:21-27` | 参数保存逐字段 upsert/deleteMany 串行执行（30 SKU × 30 字段 ≈ 900 次 DB 往返） | 参数矩阵保存明显变慢 | 事务内批量 diff + createMany | 中 |
| 19 | `dashboard/news/actions.ts:13`、`projects/actions.ts:13` | 全项目仅这两个 update 动作漏记审计日志 | 审计链不完整 | 同事务补 auditLog.create | 高 |
| 20 | 各 actions 文件（~10 处） | 「按 tenantId findFirst 校验→否则抛异常」样板复制粘贴 | 新增查询易漏租户条件 | 抽 `mustFindInTenant` 共享 helper | 高 |
| 21 | `src/app/[locale]/` 全站 | 无 not-found.tsx / error.tsx / loading.tsx | 404 丢导航与主题；DB 异常显示默认错误页 | 补三件套（保留租户导航的 not-found） | 中 |
| 22 | `src/app/layout.tsx:15` | `<html lang="zh-CN">` 硬编码 | /en 页面 lang 属性错误（a11y + SEO） | 按 locale 动态设置 lang | 高 |
| 23 | `docker-compose.yml` | postgres/postgres 默认凭据 + 无备份策略 | 生产沿用此配置即裸奔 | 环境变量注入密码；补备份/恢复演练 | 中 |
| 24 | 部署级 | 未设置 NEXT_SERVER_ACTIONS_ENCRYPTION_KEY | 多实例部署时 action 闭包加密失效 | 生产环境加入稳定密钥 | 中 |
| 25 | 项目级 | 企业设置 4 个 P0 项无数据支撑：导航设置、首页模块、域名管理 UI、SEO 默认值 | PRD「非技术人员可独立配置」目标落空，导航/首页硬编码 | 补数据模型 + 设置 UI | 高 |
| 26 | `prisma/schema.prisma` | 缺失 10+ 业务实体：套餐/配额、AI 用量账本、单页内容区块、导航配置、案例↔产品关联、产品标签、SEO 扩展字段、询盘处理记录、通知/邮件日志、FAQ、回收站机制 | PRD P1/P2 功能无模型支撑，后续要从零建 | 分阶段补模型（优先案例↔产品、内容区块、SEO 字段） | 高 |

## 轻微问题（18 条）

| # | 位置 | 问题 | 建议 | 置信度 |
|---|---|---|---|---|
| 27 | `src/lib/auth/session.ts:18` | jwtVerify 未固定 `algorithms:["HS256"]` | 补算法白名单（防御纵深） | 高 |
| 28 | `src/lib/tenant/scope.ts:2`、`src/lib/auth/dal.ts:25-29` | `tenantScope()`/`requireTenant()` 零调用死代码 | 启用或删除以免误导 | 高 |
| 29 | `src/lib/auth/dal.ts:21` | FORBIDDEN 抛 Error → 表现为 500 而非 403 | 捕获后规范化错误响应 | 中 |
| 30 | `src/lib/db.ts:5` | PrismaClient 单例未用 globalThis 防护 | dev 热重载可能多实例连接泄漏 | 中 |
| 31 | `src/lib/storage.ts:8` + `api/assets/[id]/route.ts` | readFile 全量读入内存，下载不流式 | 大文件（25MB CAD/STEP）内存占用高，改流式响应 | 高 |
| 32 | dashboard 各 actions | 非 FormData 参数仅编译期类型约束，无运行时 zod 校验 | 对位置参数二次 safeParse | 中 |
| 33 | `dashboard/products/[id]/page.tsx:21` | 上传表单无 Origin/Sec-Fetch-Site 校验 | 上传 API 双保险校验 | 中 |
| 34 | 3 个详情页删除按钮 | 零确认一步执行 | 加 confirm 或两步确认 | 高 |
| 35 | `[locale]/public-navigation.tsx:16` | 语言切换正则 replace 丢失 searchParams | 用 URLSearchParams 保留参数 | 高 |
| 36 | `[locale]/about/page.tsx:8` 等 | 计数按 status 而非当前语言 isPublished 过滤，口径与列表页不一致 | 统一口径 | 中 |
| 37 | `dashboard/products/actions.ts:29` | update 校验分类未过滤 isActive（与 create 不一致） | 补 isActive 条件 | 高 |
| 38 | `dashboard/page.tsx:20` 等 | 语言数、覆盖率公式 90/10 等魔法数字硬编码 | 提取命名常量 | 高 |
| 39 | `[locale]/products/[slug]/page.tsx:10` | generateMetadata 查不到数据返回 {} 而非 notFound() | 元数据内 notFound() | 高 |
| 40 | `[locale]/contact/actions.ts:8` | zod v4 仍用 z.string().email()（classic API） | 迁移 z.email() | 中 |
| 41 | `package.json:6-7` | 无自定义 webpack 配置却强制 --webpack 退出 Turbopack | 回归默认 Turbopack | 中 |
| 42 | `prisma/schema.prisma:1` | 仍用 legacy prisma-client-js generator | 评估迁移新 prisma-client generator | 低 |
| 43 | 全库 | 单行压缩代码风格 + 零注释，安全不变量（租户边界/软删除/审计同事务）仅隐含在模式中 | 格式化；不变量写进 CLAUDE.md | 中 |
| 44 | 项目根 `error.log` | 含第三方账号 ID 的日志未 gitignore | 加入 .gitignore 并清理 | 中 |
| 45 | `src/lib/auth/permissions.ts:6-7` | PLATFORM_ADMIN 与 TENANT_ADMIN 权限完全相同 | 待平台后台落地时收敛平台专属权限 | 中 |
| 46 | `prisma/seed.ts:17` | domain upsert 的 update 会把已存在 hostname 重挂到当前租户 | update 只更新 isPrimary/isVerified，不改 tenantId | 低 |

## 正面观察

1. **Next 16 合规近乎满分**：异步 cookies/headers、Promise params/searchParams、官方 PageProps/LayoutProps 类型助手、ESLint flat config 全部正确（对照本地文档逐项核实，两个 agent 独立确认）。
2. **租户隔离纪律严格**：24+ 处查询全部带 tenantId，公开站还叠加 PUBLISHED/deletedAt/isPublished/visibility 过滤；「先查后写」路径二次白名单校验，未发现 IDOR。
3. **鉴权模型正确**：8 个 server action + 12 个后台页面全部服务端强制校验，无「只藏按钮不校验」；写/发布/删除权限分级合理。
4. **注入与 XSS 面干净**：无 raw SQL、无 dangerouslySetInnerHTML/eval、无硬编码密钥、`.env` 已 gitignore、SESSION_SECRET 强度足够、cookie 属性（httpOnly+sameSite=lax+生产 secure）全部正确。
5. **输入校验全面**：zod 覆盖全部表单且前后端一致（slug 正则、颜色 hex、长度上限、蜜罐 max(0) 实现正确）。
6. **状态机自洽**：软删除（deletedAt+ARCHIVED）查询处处过滤；双语独立发布（ZH_CN/EN 独立 isPublished）联动 status/publishedAt 正确。
7. **审计日志与业务写入同事务**（除 2 处遗漏），参数保存还记录变更量 metadata，设计良好。
8. **查询组织健康**：无 N+1（一次 include 关联），home 限 take:3，capabilities Promise.all 并发计数，列表空态文案齐全。
9. **资产下载授权矩阵完整**：visibility × 租户状态 × publicDownloads × 关联产品发布态，CONTROLLED/INTERNAL 要求同租户会话。
10. **工程卫生**：lockfile 已提交、路径穿越双防护（safeObjectKey + startsWith 校验）、错误处理风格一致。

## 建议处理顺序

1. **上线阻断项**（修完才可上生产）：#1 数据丢失 Critical → #2 升级 next → #3 凭据管理 → #4 会话吊销
2. **PRD P0 功能缺口**：#6 平台后台 → #7 询盘闭环 → #8 SEO → #9 筛选搜索
3. **工程质量债**：#5 唯一约束处理 → #19 审计补记 → #20 租户校验 helper → #26 补模型 → 测试基建（零测试零 CI 为全项目级风险，优先补 #1/#5 回归测试与租户边界矩阵测试）
