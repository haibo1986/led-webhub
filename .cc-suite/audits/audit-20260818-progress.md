# led-webhub 系统性代码分析 — 断点文件

> 生成时间：2026-08-18。任务状态：**已完成**（2026-08-18 当日收尾）。
> 最终报告：`.cc-suite/audits/audit-20260818-findings.md`（46 条发现：严重 11 / 中等 15 / 轻微 18 + 正面观察 + 处理顺序）。
> 任务性质：只分析、不修复（硬约束，已遵守，全程未修改任何项目文件）。

## 任务背景

用户需求：对当前路径代码做系统性多维度专家分析，允许调用专家 agent/skill/cc-suite(Codex)，
输出分级问题清单，**不修复代码**。提示词已经 sweety 优化（8 维度框架），执行中修正了
sweety 的一个错误判断：仓库确有业务代码（led-webhub/src 共 74 文件、约 3 万行），
审计对象是成熟业务代码而非脚手架。

## 已完成的三条分析线（结论摘要）

### A. PRD 差距分析（专家 agent，已完成）
对照 PRD_V1.1.docx（22 章）与全部源码。5 大关键差距：
1. **平台运营后台整体缺失**（PRD 12 章 P0 全缺）：租户开通/停用、域名管理、模板分配无任何 UI/action
2. **询盘闭环断链**：产品详情页无询盘入口、无邮件提醒（Inquiry.productId 从不写入）
3. **产品筛选未兑现**（PRD 4.3）：仅分类筛选，无关键词搜索/参数筛选 UI/分页
4. 企业设置半成品：导航/首页模块/域名/SEO 默认值 4 个 P0 设置项无数据模型
5. SEO 基础设施为零：无 sitemap/robots/hreflang/canonical（上线门槛 AC-11 过不了）
另：缺失模型清单（套餐/配额、AI 用量、单页内容区块、导航配置、案例↔产品关联、产品标签、询盘备注、邮件日志、FAQ、回收站等 10+ 实体）。

### B. Next 16 约定 + 安全审计（专家 agent，已完成）
- Next 16 合规性近乎满分：异步 cookies/headers、Promise params/searchParams、flat config、类型助手全部符合
- 唯一非最优：`--webpack` 无自定义配置却退出 Turbopack（合法但多余）
- 高危×3：登录页明文展示演示账号(login/page.tsx:14)；seed 每次运行重置密码为公开值(seed.ts:20)；
  登录无限流(login/actions.ts:11-23)
- 高危：资产下载路由只验 JWT 不查 DB（api/assets/[id]/route.ts:10），停用用户 8h 内仍可下载内部文件
- 中危×4：无安全响应头/CSP(next.config.ts)；询盘表单无限流(contact/actions.ts)；
  fileName CR/LF 响应头注入(api/assets/[id]/route.ts:11, api/products/[id]/assets/route.ts)；
  多实例缺 NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
- 低/Info：jwtVerify 未固定 algorithms(session.ts:18)；tenantScope()(scope.ts:2) 与 requireTenant()(dal.ts:25-28)
  为零调用死代码；mimeType 信任客户端；PLATFORM_ADMIN 与 TENANT_ADMIN 权限相同
- 正面：8 个 server action + 12 后台页面全部服务端强制鉴权；24 处租户查询全带 tenantId，无 IDOR；
  无 raw SQL/XSS；.env 未泄漏；SESSION_SECRET 强度足够

### C. 全库模式扫描（主 agent，已完成）
无 TODO/FIXME、无 raw SQL、无 dangerouslySetInnerHTML、无 console 残留、无硬编码密钥、
无 `any` 滥用、无 ts-ignore。**零测试文件、零 CI 配置**（第 7 维为整体性发现）。

## Codex 九维审计状态（进行中，已 2 次超时）

- 尝试 1：10 文件/high effort/570s 期限 → stalled。jobId=audit-msxu7v1e-5tsm72，threadId=01a011f4-f105-7020-bb44-c20e17299649
- 尝试 2：5 文件/high effort/900s/resume 同线程 → stalled。jobId=audit-msxum14a-5k5c4c
- 尝试 3（探针）：2 文件(session.ts, login/actions.ts)/medium effort/600s/全新线程 → **stalled**。
  jobId=audit-msxvnfyz-ktyxth，threadId=01a01219-a9cd-7c11-8077-1c9c81c89dde
- **结论（2026-08-18 已定案）**：gpt-5.6-sol 在 high/medium 两种 effort、10/5/2 文件三种规模、
  resume/全新两种线程下**连续 3 次超时**。按 skill 规则（stalled 不重试、转 fallback），
  **Codex 线正式关闭**，恢复后直接执行人工兜底九维审计，无需再试 runner。

## 恢复后的执行计划

1. **Codex 线**：不再重试 runner 调用（skill 规定：stalled 不原样重试）。
   恢复后直接按 cc-suite fallback.md 转**人工兜底九维审计**，由 Claude 亲自读文件完成剩余审计，
   报告头注明「Codex unavailable — manual analysis」诊断块（诊断脚本见 fallback.md）。
   例外：若用户明确要求再试 Codex，可换 gpt-5.6-luna + low effort 单文件试一次。
2. **人工兜底范围**（Codex 未覆盖的九维审计）：
   - 剩余 48 个手写文件 + prisma/schema.prisma、seed.ts、next.config.ts、tsconfig.json、
     eslint.config.mjs、postcss.config.mjs、prisma.config.ts
   - 重点维度：逻辑正确性、错误处理、维护性、性能（N+1/索引/分页）、依赖安全（npm audit）、
     文档与知识传递、测试缺失（已有结论）
3. **交叉验证**：把 A/B/C 三条线结论 + 兜底审计互相印证去重，剔除误报，标注置信度。
4. **输出最终报告**（用户要求的格式）：
   - 严重/中等/轻微三级分组，每条五字段：位置(file:line)/问题描述/影响/修复建议/置信度
   - 报告末尾「项目现状总评」3-5 句
   - 附各条线来源标注（Codex 审计 / 专家 agent / 主 agent）
   - 全程中文，表格对比优先
5. 硬约束：只分析不修复；禁止修改任何文件、禁止运行会改变状态的命令。

## 环境备忘

- 项目根：/mnt/e/codex ai codeing/smk；代码目录：led-webhub/
- 本地 Next 16 文档：led-webhub/node_modules/next/dist/docs/
- Codex CLI：codex-cli 0.147.0，7 模型可用，默认 gpt-5.6-sol（chatgpt_login 认证）
- runner 脚本：/home/haibo/.claude-deepseek/plugins/cache/xiaolai/cc-suite/2.0.0/scripts/codex-runner.mjs
- 用户决策规则：选择题 2 选第 1 个、3+ 选第 2 个；汇报用陈述句；计划内任务自动连续推进
