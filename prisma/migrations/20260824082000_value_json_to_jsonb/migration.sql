-- 参数值列 Json → JsonB：公开站参数筛选（审计 #9）需要 jsonb 的等值过滤能力，
-- json 类型在 Postgres 上不支持 equals 比较。
ALTER TABLE "VariantParameterValue" ALTER COLUMN "valueJson" SET DATA TYPE JSONB USING "valueJson"::jsonb;
