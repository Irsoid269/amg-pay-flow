import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting AMG contracts synchronization...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create sync status record
    const { data: syncStatus, error: syncError } = await supabase
      .from('amg_sync_status')
      .insert({
        sync_started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .select()
      .single();

    if (syncError) {
      console.error('Failed to create sync status:', syncError);
      throw syncError;
    }

    const syncId = syncStatus.id;
    console.log(`✅ Sync status created with ID: ${syncId}`);

    // Get AMG API credentials
    const username = Deno.env.get('AMG_API_USERNAME');
    const password = Deno.env.get('AMG_API_PASSWORD');

    if (!username || !password) {
      throw new Error('AMG API credentials not configured');
    }

    // Step 1: Login to AMG API
    console.log('🔐 Authenticating with AMG API...');
    const loginResponse = await fetch('https://dev.amg.km/api/api_fhir_r4/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      throw new Error('AMG authentication failed');
    }

    const loginData = await loginResponse.json();
    const authToken = loginData.token || loginData.access_token;

    if (!authToken) {
      throw new Error('No auth token received');
    }

    console.log('✅ Authentication successful');

    // Step 2: Paginate through ALL contracts
    let currentUrl: string | null = 'https://dev.amg.km/api/api_fhir_r4/Contract/?_count=1000&_sort=-_lastUpdated';
    let pageNumber = 1;
    let totalContractsProcessed = 0;
    let totalContracts = 0;
    const contractsToUpsert: any[] = [];

    console.log('📄 Starting pagination through all contracts...\n');

    while (currentUrl) {
      console.log(`Page ${pageNumber}: Fetching contracts...`);

      const contractResponse: Response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!contractResponse.ok) {
        console.error(`Failed to fetch contracts on page ${pageNumber}`);
        break;
      }

      const contractData: any = await contractResponse.json();
      totalContracts = contractData.total || 0;
      const contractsInPage = contractData.entry?.length || 0;
      totalContractsProcessed += contractsInPage;

      console.log(`  Retrieved ${contractsInPage} contracts`);
      console.log(`  Progress: ${totalContractsProcessed}/${totalContracts} (${Math.round((totalContractsProcessed / totalContracts) * 100)}%)`);

      // Process contracts from this page
      if (contractData.entry && contractData.entry.length > 0) {
        for (const entry of contractData.entry) {
          const contract = entry.resource;
          
          // Skip contracts without valid ID
          if (!contract.id) {
            console.log('⚠️ Skipping contract without ID');
            continue;
          }
          
          const contractSubject = contract.subject?.[0]?.reference || '';
          
          // Extract group ID
          const groupMatch = contractSubject.match(/Group\/(.+)/);
          if (!groupMatch) continue;
          
          const groupId = groupMatch[1];
          
          // Extract period
          const period = contract.term?.[0]?.asset?.[0]?.period?.[0];
          const periodStart = period?.start ? new Date(period.start).toISOString() : null;
          const periodEnd = period?.end ? new Date(period.end).toISOString() : null;
          
          // Check if period is valid
          let periodValid = false;
          if (period) {
            const now = new Date();
            const start = new Date(period.start);
            const end = new Date(period.end);
            periodValid = now >= start && now <= end;
          }
          
          // Check if has payment
          let hasPayment = false;
          const premiumExt = contract.term?.[0]?.asset?.[0]?.extension?.find(
            (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/contract-premium'
          );
          if (premiumExt?.extension) {
            const receiptExt = premiumExt.extension.find((ext: any) => ext.url === 'receipt');
            if (receiptExt?.valueString) {
              hasPayment = true;
            }
          }
          
          const isActive = periodValid && hasPayment;
          
          contractsToUpsert.push({
            id: contract.id,
            group_id: groupId,
            contract_data: contract,
            period_start: periodStart,
            period_end: periodEnd,
            has_payment: hasPayment,
            is_active: isActive,
            last_updated: new Date().toISOString(),
          });
        }
      }

      // Batch upsert every 1000 contracts
      if (contractsToUpsert.length >= 1000) {
        console.log(`  💾 Upserting batch of ${contractsToUpsert.length} contracts...`);
        const { error: upsertError } = await supabase
          .from('amg_contracts')
          .upsert(contractsToUpsert, { onConflict: 'id' });

        if (upsertError) {
          console.error('Upsert error:', upsertError);
        } else {
          console.log(`  ✅ Batch upserted successfully`);
        }

        // Update sync status
        await supabase
          .from('amg_sync_status')
          .update({
            total_contracts: totalContracts,
            contracts_synced: totalContractsProcessed,
          })
          .eq('id', syncId);

        contractsToUpsert.length = 0; // Clear array
      }

      // Get next page
      const nextLink: any = contractData.link?.find((link: any) => link.relation === 'next');
      if (nextLink) {
        currentUrl = decodeURIComponent(nextLink.url).replace(/^https%3A%2F%2F/, 'https://');
        pageNumber++;
      } else {
        console.log('📍 Reached end of pagination');
        currentUrl = null;
      }
    }

    // Upsert remaining contracts
    if (contractsToUpsert.length > 0) {
      console.log(`💾 Upserting final batch of ${contractsToUpsert.length} contracts...`);
      const { error: upsertError } = await supabase
        .from('amg_contracts')
        .upsert(contractsToUpsert, { onConflict: 'id' });

      if (upsertError) {
        console.error('Final upsert error:', upsertError);
      } else {
        console.log('✅ Final batch upserted successfully');
      }
    }

    // Update sync status to completed
    await supabase
      .from('amg_sync_status')
      .update({
        sync_completed_at: new Date().toISOString(),
        total_contracts: totalContracts,
        contracts_synced: totalContractsProcessed,
        status: 'completed',
      })
      .eq('id', syncId);

    console.log(`\n🎉 Synchronization completed successfully!`);
    console.log(`   Total contracts processed: ${totalContractsProcessed}`);
    console.log(`   Pages processed: ${pageNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalContractsProcessed,
        totalContracts,
        pagesProcessed: pageNumber,
        syncId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Synchronization error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: 'Synchronization failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
