@AGENTS.md

# 项目安全不变量（修改任何代码前必读）

以下三条铁律贯穿整个代码库，任何修改都必须保持，违反即视为 bug：

1. **租户隔离**：所有租户数据查询必须从已验证 Session 获取 `tenantId`（后台用 `requireSession()`/`requirePermission()`，公开站用 `getPublicTenant()`），并通过 `tenantScope()` 或显式 `tenantId` 条件注入查询。永远不要信任请求参数中的租户信息；跨租户访问必须抛 `TENANT_BOUNDARY_VIOLATION`。
2. **软删除**：产品/新闻/案例的删除一律走 `deletedAt + status: ARCHIVED`，所有查询必须过滤 `deletedAt: null`。
3. **审计同事务**：所有写操作（创建/更新/发布/删除/状态变更）必须在同一事务内写入 `AuditLog`，action 命名遵循 `RESOURCE_ACTION` 约定（如 `PRODUCT_UPDATED`）。

其他约定：

- 双语发布：ZH_CN / EN 翻译独立 `isPublished`，发布任一语言时同步产品/案例/新闻主表的 `status` 与 `publishedAt`。
- 权限：`requirePermission` 覆盖所有 server action 与后台页面入口；权限不足重定向 `/dashboard?error=forbidden`。
- 公开站内容只展示：`status: PUBLISHED` + `deletedAt: null` + 当前语言 `isPublished` +（资产）`visibility` 允许的可见性。
- Next 16 破坏性变更：`params`/`searchParams` 是 Promise、`cookies()`/`headers()` 需 await、中间件文件叫 `proxy.ts`；拿不准时先查 `node_modules/next/dist/docs/`。
