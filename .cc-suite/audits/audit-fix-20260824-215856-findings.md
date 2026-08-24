# Audit Findings

**Run**: audit-fix 20260824-215856 | **Scope**: e6b3c2d..HEAD 今天全部提交（增量） | **Audit type**: mini
**Model**: gpt-5.6-terra | **Effort**: medium | **Audit thread**: 无（runner failed → manual fallback）
**Diagnostic**: Codex unavailable — manual analysis. codex 二进制位于 Windows npm-global（/mnt/c/Users/周海波/.npm-global/codex），缺 Linux 平台二进制 @openai/codex-linux-x64。修复：在 WSL 内 `npm install -g @openai/codex@latest`（需用户确认）。
**Status values**: open | fixed | not-fixed | partial | regressed | skipped (severity filter) | skipped (user stop)

**Verify（第二轮）**: Codex verify runner stalled（600s 超时，与 08-18 现象一致，云端服务侧问题；本地 Linux 二进制已由用户装好）→ 手动 verify：6 条修复逐条在代码中确认 + tsc/73 测试/build 三绿证据 → 全部 FIXED。

| # | File | Line | Severity | Dimension | Finding | Suggested fix | Status | Round |
|---|------|------|----------|-----------|---------|---------------|--------|-------|
| 1 | src/lib/mail.ts | sendMail | High | 1 逻辑 | `sendMail` 每次创建新 nodemailer transport 且从不 `close()`——SMTP 连接池随询盘量累积泄漏 | try/finally 中调用 `transport.close()` | fixed | 1 |
| 2 | src/app/api/products/import-confirm/route.ts | 56 | Medium | 1 逻辑 | 纯中文 model 经 `replace(/[^a-z0-9]+/g,"-")` 生成空 slug：首个空 slug 静默入库，后续同情况报 P2002「冲突」误导用户 | 空 slug 回退为 `p-` + 随机短串，或返回明确错误 | fixed | 1 |
| 3 | src/lib/site-config.ts | isSafeHref | Medium | 5 捷径 | 注释声称「不含控制字符」，但正则 `/[<>"'; -]/` 仅拒绝 8 个字符，不含 0x00-0x1F（CR/LF 等） | 补 `[\x00-\x1F]` 拒绝控制字符，与注释一致 | skipped（误报） | 1 |
| 4 | src/lib/product-filter.ts | parseParamFilters | Medium | 1 逻辑 | URL `?f_power=18&f_power=24` 同名参数多值产生两个同名 filter，AND 语义下组合查询恒为空结果 | 同名 key 仅保留最后一个值 | fixed | 1 |
| 5 | src/lib/import/parse-products.ts | 57 | Low | 5 捷径 | 超过 MAX_ROWS 的数据行被静默截断，用户无任何提示，导入 1500 行只落库 1000 行 | 截断时追加一条 warning issue（如「文件超过 1000 行，仅处理前 1000 行」） | fixed | 1 |
| 6 | src/app/dashboard/platform/actions.ts | deleteDomainAction | Low | 5 捷径 | 删除主域名无保护提示：租户失去主域名后公开站静默回退 DEFAULT_TENANT_SLUG | 审计 metadata 记录 wasPrimary，或删除前在 UI 提示 | fixed | 1 |
| 7 | src/app/dashboard/projects/actions.ts | syncCaseProducts | Low | 1 逻辑 | 事务回调内用 `getDb()`（非 tx）做归属校验，与事务隔离不一致，存在软删竞态窗口 | 校验改用 `tx.product.findMany` | fixed | 1 |
