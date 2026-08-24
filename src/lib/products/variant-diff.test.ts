import { describe, expect, it } from "vitest";
import { diffVariants } from "./variant-diff";

// 审计 #1 回归测试：diff 式变体更新只删被移除的 SKU、只增新 SKU，未变的保留原 id。
describe("diffVariants", () => {
  it("仅改产品名称（SKU 完全不变）时：零删除、零新增，参数值不受影响", () => {
    const existing = [{ id: "v1", sku: "XW-100A" }, { id: "v2", sku: "XW-100B" }];
    expect(diffVariants(existing, ["XW-100A", "XW-100B"])).toEqual({ toDeleteIds: [], toCreateSkus: [] });
  });

  it("移除一个 SKU：仅该 SKU 被删除，其余保留原 id", () => {
    const existing = [{ id: "v1", sku: "A" }, { id: "v2", sku: "B" }, { id: "v3", sku: "C" }];
    expect(diffVariants(existing, ["A", "C"])).toEqual({ toDeleteIds: ["v2"], toCreateSkus: [] });
  });

  it("新增一个 SKU：仅新增项进入 toCreate，未触发任何删除", () => {
    const existing = [{ id: "v1", sku: "A" }];
    expect(diffVariants(existing, ["A", "B", "C"])).toEqual({ toDeleteIds: [], toCreateSkus: ["B", "C"] });
  });

  it("同时增删：删除与新增互不干扰", () => {
    const existing = [{ id: "v1", sku: "A" }, { id: "v2", sku: "B" }];
    expect(diffVariants(existing, ["B", "D"])).toEqual({ toDeleteIds: ["v1"], toCreateSkus: ["D"] });
  });

  it("空 wanted 列表：全部删除（调用方 zod 已保证至少 1 个 SKU，此处仅验证函数行为）", () => {
    const existing = [{ id: "v1", sku: "A" }];
    expect(diffVariants(existing, [])).toEqual({ toDeleteIds: ["v1"], toCreateSkus: [] });
  });
});
