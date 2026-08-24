import { z } from "zod";

// 产品表单校验（create/update 共用），独立于 server action 以便测试覆盖。
export const productSchema = z.object({
  categoryId: z.string().min(1),
  model: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  nameZh: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(160),
  taglineZh: z.string().trim().max(200),
  taglineEn: z.string().trim().max(240),
  skus: z.array(z.string().trim().min(2).max(80)).min(1).max(30).refine((items) => new Set(items).size === items.length, { message: "SKU 不允许重复" }),
});

export function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    categoryId: formData.get("categoryId"),
    model: formData.get("model"),
    slug: formData.get("slug"),
    nameZh: formData.get("nameZh"),
    nameEn: formData.get("nameEn"),
    taglineZh: formData.get("taglineZh") ?? "",
    taglineEn: formData.get("taglineEn") ?? "",
    skus: String(formData.get("skus") ?? "").split(/\r?\n|,/).map((v) => v.trim()).filter(Boolean),
  });
}
