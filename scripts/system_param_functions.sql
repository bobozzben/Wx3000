-- ============================================================================
-- 總體參數存取 PL/pgSQL 預存函數 (PostgreSQL 16 / Database: a3000)
-- 欄位結構：文字類型 (TEXT)，欄位名稱："名稱"、"數值"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 讀取總體參數函數 (get_sys_param)
-- 傳入參數：
--   p_schema  : Schema 名稱 (例如 'public' 或 'e3000__comm')
--   p_table   : Table 名稱 (例如 'sys_config' 或 'wbase_param')
--   p_name    : 參數名稱 (搜尋 "名稱" 欄位)
--   p_default : 找不到時的預設值 (選填，預設為空白字串 '')
-- 回傳：
--   "數值" 欄位文字；若找不到會自動在該 Table 插入一列並回傳預設值
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_sys_param(
    p_schema TEXT,
    p_table TEXT,
    p_name TEXT,
    p_default TEXT DEFAULT ''
)
RETURNS TEXT AS $$
DECLARE
    v_sql TEXT;
    v_val TEXT;
BEGIN
    -- 自動建立 Schema 與 Table (若不存在)
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I;', p_schema);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I ("名稱" TEXT PRIMARY KEY, "數值" TEXT);', p_schema, p_table);

    -- 依名稱尋找
    v_sql := format('SELECT "數值" FROM %I.%I WHERE "名稱" = $1 LIMIT 1;', p_schema, p_table);
    EXECUTE v_sql INTO v_val USING p_name;

    -- 若找到則傳回
    IF v_val IS NOT NULL THEN
        RETURN v_val;
    END IF;

    -- 找不到則自動增加一列，預設值是空白 (或指定之預設值)
    BEGIN
        v_sql := format('INSERT INTO %I.%I ("名稱", "數值") VALUES ($1, $2);', p_schema, p_table);
        EXECUTE v_sql USING p_name, COALESCE(p_default, '');
    EXCEPTION WHEN unique_violation THEN
        -- 若有平行寫入發生衝突，忽略並讀取寫入的值
        v_sql := format('SELECT "數值" FROM %I.%I WHERE "名稱" = $1 LIMIT 1;', p_schema, p_table);
        EXECUTE v_sql INTO v_val USING p_name;
        IF v_val IS NOT NULL THEN
            RETURN v_val;
        END IF;
    END;

    RETURN COALESCE(p_default, '');
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- 2. 設定總體參數函數 (set_sys_param)
-- 傳入參數：
--   p_schema : Schema 名稱 (例如 'public' 或 'e3000__comm')
--   p_table  : Table 名稱 (例如 'sys_config' 或 'wbase_param')
--   p_name   : 參數名稱 ("名稱" 欄位)
--   p_value  : 參數數值 ("數值" 欄位)
-- 回傳：
--   已設定的數值
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_sys_param(
    p_schema TEXT,
    p_table TEXT,
    p_name TEXT,
    p_value TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_sql TEXT;
    v_updated_rows INT;
BEGIN
    -- 自動建立 Schema 與 Table (若不存在)
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I;', p_schema);
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.%I ("名稱" TEXT PRIMARY KEY, "數值" TEXT);', p_schema, p_table);

    -- 先嘗試 UPDATE 更新
    v_sql := format('UPDATE %I.%I SET "數值" = $2 WHERE "名稱" = $1;', p_schema, p_table);
    EXECUTE v_sql USING p_name, COALESCE(p_value, '');
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

    -- 找不到則自動新增一列
    IF v_updated_rows = 0 THEN
        v_sql := format('INSERT INTO %I.%I ("名稱", "數值") VALUES ($1, $2);', p_schema, p_table);
        EXECUTE v_sql USING p_name, COALESCE(p_value, '');
    END IF;

    RETURN COALESCE(p_value, '');
END;
$$ LANGUAGE plpgsql;
