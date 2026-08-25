import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { isTranslateConfigured, translateToEnglish, type TranslateModule } from "@/lib/translate";

// 通用「一键翻译」server action 工厂（sweety P0 基建）：
// 固化守卫链与语义——权限 → 租户 AI 开关 → API key → 中文内容非空 → 并行翻译 → EN 写入（绝不置 isPublished）→ 审计同事务。
// 各模块只需提供查询/取值/写入三个回调，避免每个模块复制一套守卫逻辑。

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["$transaction"]>[0]>[0];

export type TranslateActionConfig<T> = {
  permission: "content:write" | "tenant:manage";
  resource: string;
  auditAction: string;
  module: TranslateModule;
  redirectBase: string;
  /** 重定向目标自定义（默认 `${redirectBase}/${id}`）；无 id 路径的模块（如企业设置）用它覆盖 */
  redirectPath?: (id: string) => string;
  /** 带租户过滤与软删过滤的查询；返回 null 表示跨租户/不存在 */
  findItem: (tenantId: string, id: string) => Promise<T | null>;
  /** 中文源文本按序返回；null/空串 = 该字段不翻译（英文保持空），保证与 buildEnWrite 的索引对齐 */
  getZhTexts: (item: T) => (string | null)[];
  /** 在事务内写入英文译文（upsert EN translation/字段；不得修改 isPublished）。en 长度与 getZhTexts 一致，空源对应空串 */
  buildEnWrite: (item: T, en: string[], tx: Tx) => Promise<void>;
};

export function createTranslateAction<T>(config: TranslateActionConfig<T>) {
  return async function translateAction(id: string) {
    const session = await requirePermission(config.permission);
    const target = config.redirectPath ? config.redirectPath(id) : `${config.redirectBase}/${id}`;
    const tenant = await getDb().tenant.findUnique({ where: { id: session.tenantId }, select: { aiEnabled: true } });
    if (!tenant?.aiEnabled) redirect(`${target}?translated=disabled`);
    if (!isTranslateConfigured()) redirect(`${target}?translated=nokey`);
    const item = await config.findItem(session.tenantId, id);
    if (!item) throw new Error("TENANT_BOUNDARY_VIOLATION");
    const zhTexts = config.getZhTexts(item);
    const sources = zhTexts.filter((t) => !!t && !!t.trim());
    if (!sources.length) redirect(`${target}?translated=empty`);
    try {
      // 并行翻译后按原位置还原，空源保持空串
      const translated = await Promise.all(sources.map((t) => translateToEnglish(t as string, { module: config.module })));
      let cursor = 0;
      const en = zhTexts.map((t) => (t && t.trim() ? translated[cursor++] : ""));
      await getDb().$transaction(async (tx) => {
        await config.buildEnWrite(item, en, tx);
        await tx.auditLog.create({ data: { tenantId: session.tenantId, actorId: session.userId, action: config.auditAction, resource: config.resource, resourceId: id, metadata: { target: "EN", fields: sources.length } } });
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("DeepSeek API")) redirect(`${target}?translated=error`);
      throw error;
    }
    revalidatePath(target);
    redirect(`${target}?translated=1`);
  };
}
