// 公开站参数筛选（审计 #9 / PRD 4.3）的纯函数层：
// URL 参数形如 f_<definitionKey>=<value>，与 category/q/page 组合。
export type ParamFilter = { key: string; value: string };

const FILTER_KEY_RE = /^[a-z][a-z0-9_]{0,40}$/;

// 从 URLSearchParams 提取参数筛选（未过滤的值直接丢弃，防注入无意义查询）
export function parseParamFilters(params: URLSearchParams): ParamFilter[] {
  const filters: ParamFilter[] = [];
  for (const [name, value] of params.entries()) {
    if (!name.startsWith("f_")) continue;
    const key = name.slice(2);
    const trimmed = value.trim();
    if (!FILTER_KEY_RE.test(key) || !trimmed || trimmed.length > 200) continue;
    filters.push({ key, value: trimmed });
  }
  return filters;
}

// 构造带筛选的查询串：保留 category/q，重置分页，合并/覆盖 f_ 参数
export function filterHref(params: URLSearchParams, next: ParamFilter[]): string {
  const out = new URLSearchParams();
  for (const [name, value] of params.entries()) {
    if (name === "page" || name.startsWith("f_")) continue;
    out.set(name, value);
  }
  for (const f of next) out.set(`f_${f.key}`, f.value);
  return out.toString();
}

// 点击同一值切换：已选则取消，未选则加入（同 key 单选）
export function toggleFilter(filters: ParamFilter[], key: string, value: string): ParamFilter[] {
  const has = filters.some((f) => f.key === key && f.value === value);
  const rest = filters.filter((f) => f.key !== key);
  return has ? rest : [...rest, { key, value }];
}

// 面板值聚合：把「当前可见产品」的参数值按定义分组去重（应用层聚合，最多展示 20 个值/参数）
export function collectFilterValues(items: { definitionId: string; raw: string }[], defIds: string[], limit = 20): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const defId of defIds) map.set(defId, new Set());
  for (const item of items) {
    const set = map.get(item.definitionId);
    if (!set || set.size >= limit) continue;
    set.add(item.raw);
  }
  return new Map([...map.entries()].map(([key, set]) => [key, [...set].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }))]));
}
