// diff 式变体更新（审计 #1 回归修复的核心逻辑，抽为纯函数以便测试覆盖）：
// 只删被移除的 SKU、只增新 SKU，未变的保留原 id，避免级联清空参数值。
export type ExistingVariant = { id: string; sku: string };

export function diffVariants(existing: ExistingVariant[], wanted: string[]) {
  const toDeleteIds = existing.filter((v) => !wanted.includes(v.sku)).map((v) => v.id);
  const toCreateSkus = wanted.filter((sku) => !existing.some((v) => v.sku === sku));
  return { toDeleteIds, toCreateSkus };
}
