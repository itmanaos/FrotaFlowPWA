
-- Migration: Add Faturamento (Invoicing)
-- 1. Update requisicao_status enum
-- Note: ALTER TYPE ... ADD VALUE cannot be executed in a transaction block.
-- We'll use a separate DO block or just run it.
DO $$ BEGIN
    ALTER TYPE requisicao_status ADD VALUE 'faturada';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create faturas table
CREATE TABLE IF NOT EXISTS faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_fatura TEXT NOT NULL UNIQUE,
    data_inicio TIMESTAMPTZ NOT NULL,
    data_fim TIMESTAMPTZ NOT NULL,
    total_litros NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_valor NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('aberta', 'fechada')) DEFAULT 'aberta',
    created_by UUID REFERENCES perfis(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add fatura_id to requisicoes_abastecimento
ALTER TABLE requisicoes_abastecimento ADD COLUMN IF NOT EXISTS fatura_id UUID REFERENCES faturas(id);

-- 4. Enable RLS and add policies
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso Autenticado" ON faturas;
CREATE POLICY "Acesso Autenticado" ON faturas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Add to realtime
-- Check if table is already in publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'faturas'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE faturas;
    END IF;
END $$;
