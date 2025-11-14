-- Create table to store AMG contracts for fast lookup
CREATE TABLE IF NOT EXISTS public.amg_contracts (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  contract_data JSONB NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  has_payment BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_amg_contracts_group_id ON public.amg_contracts(group_id);
CREATE INDEX IF NOT EXISTS idx_amg_contracts_is_active ON public.amg_contracts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_amg_contracts_period ON public.amg_contracts(period_start, period_end);

-- Create table to track synchronization status
CREATE TABLE IF NOT EXISTS public.amg_sync_status (
  id SERIAL PRIMARY KEY,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  total_contracts INTEGER DEFAULT 0,
  contracts_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.amg_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amg_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies for amg_contracts (read-only for authenticated users)
CREATE POLICY "Authenticated users can view contracts"
  ON public.amg_contracts
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for amg_sync_status (read-only for authenticated users)
CREATE POLICY "Authenticated users can view sync status"
  ON public.amg_sync_status
  FOR SELECT
  TO authenticated
  USING (true);