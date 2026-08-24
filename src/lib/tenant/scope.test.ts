import { describe, expect, it } from "vitest";
import { tenantScope } from "./scope";

describe("tenantScope（租户隔离注入）", () => {
  it("把 tenantId 注入 where 条件，与既有条件合并", () => {
    expect(tenantScope("t-1", { slug: "xw-100" })).toEqual({ slug: "xw-100", tenantId: "t-1" });
  });

  it("无既有条件时只带 tenantId", () => {
    expect(tenantScope("t-1")).toEqual({ tenantId: "t-1" });
  });

  it("空 tenantId 直接抛错（拒绝未验证会话），不产生无边界查询", () => {
    expect(() => tenantScope("")).toThrow("A verified tenant id is required");
  });
});
