# 产品资料分区上传与展示（方案 B）

## Context

产品资料上传能力已存在（上传 API + `ProductAsset.role` + 资产关联），但所有文件混在一个列表里，公开站产品详情页甚至**没有真实产品图**（hero 右边是 CSS 装饰的「灯光对象」，非真实图片）。

需求是把产品资料按「图片 / 尺寸图 / 技术规格资料」三区**分开上传（后台）+ 分开展示（公开站）**。这是「方案 A（PDF 智能解析）」之前先落地的方案 B，底层能力复用、投入小、见效快。

已拍板的三个决策：
1. **role 复用**（不改 schema）：图片→`IMAGE`、尺寸图→`CAD`、技术资料→`DOCUMENT`（+`PHOTOMETRY` 光度文件一并归入技术资料区）。
2. **公开站图片区**：主图大图 + 缩略图轮播（需客户端组件）。
3. **技术资料 = 文件下载**（规格书 PDF 等），参数本身已有独立规格矩阵区。

## 核心方案

- **不改 `prisma/schema.prisma`**，分区完全靠 `ProductAsset.role` 字符串在查询/渲染层划分。
- **分区逻辑收敛到单一纯模块 `src/lib/asset-roles.ts`**，后台与公开站共用，避免口径漂移。
- **图片 inline 展示是前置阻塞点**：`/api/assets/[id]` 当前恒为 `attachment`，图片无法 `<img>` 展示，必须改。

## 文件改动

### 新增（3 个）

| 文件 | 内容 |
|---|---|
| `src/lib/asset-roles.ts` | role 常量 + 分区定义（title/accept/roles）+ `splitPublicAssets()`（三方分流：画廊/尺寸图/下载）+ `byRoles()` + `isImageAsset()`，纯函数 |
| `src/app/[locale]/products/[slug]/product-gallery.tsx` | `"use client"` 轮播组件：主图 + 缩略图 + 前后翻页 |
| `src/app/dashboard/products/[id]/asset-partition.tsx` | 后台单个分区组件（预置 role 的上传表单 + 复用 `asset-upload`/`asset-list` 列表）|

### 修改（5 个）

| 文件 | 改动 |
|---|---|
| `src/app/api/assets/[id]/route.ts` | 第 14 行：`mimeType.startsWith("image/")` 用 `inline`，其余 `attachment` |
| `src/app/dashboard/products/[id]/page.tsx` | 第 22 行单一「技术文件与媒体」section → 三个 `<AssetPartition/>` |
| `src/app/[locale]/products/[slug]/page.tsx` | 查询后调 `splitPublicAssets()`；hero 后插入画廊区 + 尺寸图区；第 20 行下载区改渲染 `downloads` |
| `src/app/globals.css` | 末尾追加画廊/尺寸图网格/后台分区/缩略图样式（不改现有类）|
| `src/app/api/products/[id]/assets/route.ts` | （低优先级加固）role→扩展名白名单校验，防图片分区误标 PDF |

## 关键技术设计

### 1. 分区映射（`asset-roles.ts`）

```ts
const PARTITIONS = [
  { key:"IMAGE", roles:["IMAGE"], titleZh:"产品图片", accept:".jpg,.jpeg,.png,.webp" },
  { key:"CAD", roles:["CAD"], titleZh:"尺寸图", accept:".jpg,.jpeg,.png,.webp,.dwg,.dxf,.step" },
  { key:"DOCUMENT", roles:["DOCUMENT","PHOTOMETRY"], titleZh:"技术规格资料", accept:".pdf,.ies,.ldt,.dwg,.dxf,.step" },
];
```

`splitPublicAssets(items)` 分流规则：
- `role===IMAGE && image` → 画廊（gallery）
- `role===CAD && image` → 尺寸图网格（cadImages）
- `role∈{CAD,DOCUMENT,PHOTOMETRY}` 其余（含 CAD 非图片）→ 下载（downloads）
- 未知 role / 误标（IMAGE 但非图片）→ 忽略，不显示

### 2. 图片 inline（`api/assets/[id]/route.ts`）

```ts
const disposition = asset.mimeType.startsWith("image/") ? "inline" : "attachment";
```
`mimeType` 由上传接口按扩展名白名单映射，配合已有 `X-Content-Type-Options: nosniff`，inline 安全。非图片保持 attachment，下载行为零回归。

### 3. 轮播组件 `ProductGallery`（客户端）

- 唯一状态 `useState(0)`；主图防御式 `images[Math.min(active, count-1)]`；翻页取模。
- 缩略图 `aria-current={i===active}` 供 CSS 选中态；单图/空时隐藏缩略图条与按钮（`count>1` 守卫），空数组 `return null`。
- props 只含可序列化数据（`{id,src,alt}[]`），符合 RSC→Client 边界；图标用 `lucide-react`。
- 用**原生 `<img>`** 而非 `next/image`（资产是动态二进制流 + 登录态区分 Cache-Control，优化器会多一跳且需配 loader）。

### 4. 后台分区上传 `AssetPartition`（服务端组件）

- IMAGE/CAD 分区用 `<input type="hidden" name="role">` 预置 role，用户不可改；技术资料分区内用 select 选 DOCUMENT/PHOTOMETRY。
- 复用现有 `asset-upload`/`asset-list`/`asset-empty`/`visibility-*` 类；图片项渲染 `<img className="asset-thumb" src={/api/assets/{id}}>` 缩略图，非图片显示 Download 图标。

### 5. 公开站展示顺序（不重排现有块）

`hero → 图片画廊 → 尺寸图 → 规格矩阵 → 技术资料下载 → fact-note → 询盘`

画廊/尺寸图区都带 `length>0` 守卫；下载区标题「公开技术资料」不变，只把数据源从 `product.assets` 换成 `downloads`。

## 实施顺序

1. `asset-roles.ts`（纯函数地基）
2. `api/assets/[id]/route.ts`（inline，解锁图片）
3. `product-gallery.tsx`（客户端组件）
4. 公开站 `page.tsx`（分流 + 插入画廊/尺寸图 + 过滤下载）
5. 后台 `asset-partition.tsx` + `page.tsx`（三分区）
6. `globals.css`（追加样式）
7. `api/products/[id]/assets/route.ts`（role 校验，低优先级）
8. lint + build + E2E

依赖：2 是 3/4 前置；4、5 依赖 1；7 独立。

## 验证

1. **静态**：`npm run lint` + `npm run build`（tsc 类型检查）。
2. **inline 阻塞点**：上传一张公开 PNG，`curl -sI /api/assets/{id}` 断言 `Content-Disposition: inline`；PDF 断言 `attachment`。
3. **后台**：三个分区各自上传/列表正常；IMAGE 区上传 PNG 有缩略图；CAD 区 PNG 缩略图 + DWG 文件图标；重定向 `?upload=success` 正常。
4. **公开站**：画廊大图+缩略图切换+翻页正常、单图隐藏缩略图条；尺寸图网格；下载区只含 DOCUMENT/PHOTOMETRY/CAD 非图片。
5. **边界**：无图片产品不渲染画廊区；CAD 图片+dwg 产品 dwg 进下载区；INTERNAL/CONTROLLED 公开站不可见。
