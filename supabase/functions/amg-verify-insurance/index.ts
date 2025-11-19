import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatientResource {
  resourceType: string;
  id: string;
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
  [key: string]: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { insuranceNumber } = await req.json();

    if (!insuranceNumber) {
      return new Response(
        JSON.stringify({ error: 'Insurance number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Verifying insurance number:', insuranceNumber);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const username = Deno.env.get('AMG_API_USERNAME');
    const password = Deno.env.get('AMG_API_PASSWORD');

    if (!username || !password) {
      console.error('AMG API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Login to get auth token
    console.log('Authenticating with AMG API...');
    const loginResponse = await fetch('https://dev.amg.km/api/api_fhir_r4/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('AMG login failed:', loginResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loginData = await loginResponse.json();
    const authToken = loginData.token || loginData.access_token;

    if (!authToken) {
      console.error('No auth token received from login');
      return new Response(
        JSON.stringify({ error: 'Authentication failed - no token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authentication successful, searching for patient...');

    // Step 2: Get patient directly by ID
    const patientResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Patient/${insuranceNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (!patientResponse.ok) {
      const errorText = await patientResponse.text();
      console.error('Patient search failed:', patientResponse.status, errorText);
      
      if (patientResponse.status === 404) {
        return new Response(
          JSON.stringify({ exists: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to verify insurance number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patientData = await patientResponse.json();
    console.log('Patient data:', patientData);

    if (patientData.resourceType !== 'Patient') {
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patient: PatientResource = patientData;

    function normalizePolicyStatus(status: unknown): string | null {
      if (status == null) return null;
      if (typeof status === 'string') return status.toUpperCase();
      const num = typeof status === 'number' ? status : Number(status);
      switch (num) {
        case 1: return 'ACTIVE';
        case 2: return 'DRAFT';
        case 3: return 'SUSPENDED';
        case 4: return 'EXPIRED';
        case 5: return 'CANCELLED';
        default: return null;
      }
    }

    // Step 3: Get coverage information
    const coverageResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Coverage/?beneficiary=Patient/${patient.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    let coverageData = null;
    if (coverageResponse.ok) {
      coverageData = await coverageResponse.json();
      console.log('Coverage data retrieved successfully');
    }

    // Extract Group/Family ID
    const groupExtension = patient.extension?.find(
      (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/patient-group-reference'
    );
    const groupId = groupExtension?.valueReference?.identifier?.value;
    const referenceStr: string | undefined = groupExtension?.valueReference?.reference;
    const extractedUuid = referenceStr ? (referenceStr.includes('/') ? referenceStr.split('/')[1] : referenceStr) : undefined;
    // Derive the true GraphQL familyUuid from the FHIR Group resource when possible
    let familyUuidForGraphQL: string | null = extractedUuid || groupId || null;
    try {
      const groupResourceId = extractedUuid || groupId;
      if (groupResourceId) {
        const groupResp = await fetch(`https://dev.amg.km/api/api_fhir_r4/Group/${groupResourceId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        });
        if (groupResp.ok) {
          const groupJson = await groupResp.json();
          const identifiers: any[] = Array.isArray(groupJson.identifier) ? groupJson.identifier : [];
          const bySystem = identifiers.find((id: any) => typeof id.system === 'string' && /uuid|family/i.test(id.system));
          const byTypeCode = identifiers.find((id: any) => id.type?.coding?.some((c: any) => /uuid|family/i.test(c.code || '')));
          const candidate = bySystem?.value || byTypeCode?.value || null;
          if (candidate) {
            familyUuidForGraphQL = candidate;
          } else if (typeof groupJson.id === 'string') {
            familyUuidForGraphQL = groupJson.id;
          }
        }
      }
    } catch (_) {
      // Ignore group fetch errors
    }
    
    console.log('Patient belongs to Group:', groupId, '| GraphQL familyUuid:', familyUuidForGraphQL);

    // Step 3b: Query GraphQL for policies by family (active or last expired)
    let policyStatus: string | null = null;
    let policyDates: { startDate: string | null; effectiveDate: string | null; expiryDate: string | null } = {
      startDate: null,
      effectiveDate: null,
      expiryDate: null,
    };
    let policyData: any = null;
    let policyErrorText: string | null = null;

    if (familyUuidForGraphQL) {
      try {
        console.log('\n📡 Fetching policies from GraphQL for family:', groupId);
        const graphQLResponse = await fetch('https://dev.amg.km/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            query: `query GetPolicies($familyUuid: String!) {
              policiesByFamily(activeOrLastExpiredOnly: true, familyUuid: $familyUuid) {
                edges {
                  node {
                    policyUuid
                    status
                    startDate
                    effectiveDate
                    expiryDate
                    productCode
                    productName
                    policyValue
                  }
                }
              }
            }`,
            variables: { familyUuid: familyUuidForGraphQL },
          }),
        });

        if (graphQLResponse.ok) {
          const gql = await graphQLResponse.json();
          const node = gql?.data?.policiesByFamily?.edges?.[0]?.node || null;
          if (node) {
            policyData = node;
            policyStatus = normalizePolicyStatus(node.status);
            policyDates = {
              startDate: node.startDate || null,
              effectiveDate: node.effectiveDate || null,
              expiryDate: node.expiryDate || null,
            };
            console.log('✅ GraphQL policy fetched:', { status: policyStatus, dates: policyDates });
          } else {
            console.log('ℹ️ No policy found via GraphQL for this family');
            // Capture diagnostic when no policy is returned
            policyErrorText = JSON.stringify({
              message: 'No policy found for familyUuid',
              familyUuid: familyUuidForGraphQL,
              response: gql,
            });
          }
        } else {
          const errText = await graphQLResponse.text();
          console.error('GraphQL GetPolicies failed:', graphQLResponse.status, errText);
          policyErrorText = errText;
        }
      } catch (e) {
        console.error('GraphQL GetPolicies error:', e);
      }
    }

    // Fallback: try FHIR Coverage if GraphQL yielded no policy data
    if (!policyStatus && (!policyDates.startDate && !policyDates.effectiveDate && !policyDates.expiryDate)) {
      try {
        const coverageResp = await fetch(
          `https://dev.amg.km/api/api_fhir_r4/Coverage?beneficiary=Patient/${patient.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
          }
        );
        if (coverageResp.ok) {
          const cov = await coverageResp.json();
          const entry = Array.isArray(cov.entry) ? cov.entry[0] : null;
          const resource = entry?.resource || null;
          if (resource) {
            const statusVal = resource.status || null;
            const period = resource.period || {};
            const startStr = period.start || null;
            const endStr = period.end || null;
            policyStatus = normalizePolicyStatus(statusVal) || policyStatus;
            policyDates = {
              startDate: startStr,
              effectiveDate: startStr,
              expiryDate: endStr,
            };
            console.log('✅ FHIR Coverage fallback:', { status: policyStatus, dates: policyDates });
          } else {
            console.log('ℹ️ FHIR Coverage has no entry/resource for beneficiary');
          }
        } else {
          const t = await coverageResp.text();
          policyErrorText = (policyErrorText || '') + ` | Coverage fetch error: ${t}`;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        policyErrorText = (policyErrorText || '') + ` | Coverage exception: ${msg}`;
      }
    }

    // Step 4: RECHERCHE RAPIDE dans Supabase d'abord
    console.log(`\n🔍 Searching for active contract in Supabase for Group ${groupId}...`);
    
    const { data: contractsFromDb, error: dbError } = await supabase
      .from('amg_contracts')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('last_updated', { ascending: false })
      .limit(1);

    let selectedContract: any = null;
    let contractDataForResponse: any = { entry: [] };

    if (!dbError && contractsFromDb && contractsFromDb.length > 0) {
      console.log('✅ Found active contract in Supabase database!');
      selectedContract = { resource: contractsFromDb[0].contract_data };
      contractDataForResponse = { entry: [selectedContract] };
    } else {
      console.log('⚠️ No active contract found in Supabase');
      console.log('💡 Tip: Run the sync function to populate the database with AMG contracts');
    }

    // Step 5: Get unpaid invoices for the patient
    console.log('\n💰 Fetching invoices for patient...');
    let totalUnpaidAmount = 0;
    let invoicesData = null;
    
    const invoicesResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Invoice/?subject=Patient/${patient.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    if (invoicesResponse.ok) {
      invoicesData = await invoicesResponse.json();
      console.log('Invoices data retrieved successfully');
      
      // Calculate total unpaid amount
      if (invoicesData?.entry && invoicesData.entry.length > 0) {
        for (const entry of invoicesData.entry) {
          const invoice = entry.resource;
          // Consider an invoice unpaid if status is not 'balanced' or 'cancelled'
          if (invoice.status !== 'balanced' && invoice.status !== 'cancelled') {
            const amount = invoice.totalNet?.value || invoice.totalGross?.value || 0;
            totalUnpaidAmount += amount;
            console.log(`📋 Invoice ${invoice.id}: ${invoice.status} - Amount: ${amount}`);
          }
        }
        console.log(`💵 Total unpaid amount: ${totalUnpaidAmount}`);
      } else {
        console.log('ℹ️ No invoices found for patient');
      }
    }

    // Step 6: Get insurance plan
    let insurancePlanData = null;
    if (coverageData?.entry?.[0]?.resource?.class?.[0]?.value) {
      const planName = coverageData.entry[0].resource.class[0].value;
      const insurancePlanResponse = await fetch(
        `https://dev.amg.km/api/api_fhir_r4/InsurancePlan/?name=${planName}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (insurancePlanResponse.ok) {
        insurancePlanData = await insurancePlanResponse.json();
        console.log('Insurance plan data retrieved successfully');
      }
    }

    // Determine coverage status (prefer GraphQL policy, fallback to Supabase contract)
    console.log('\n=== DETERMINING COVERAGE STATUS FOR PATIENT', patient.id, '===');

    let coverageStatus = 'inactive';
    let coverageReason = 'unknown';

    const now = new Date();
    const startDateStr = policyDates.startDate || policyDates.effectiveDate;
    const start = startDateStr ? new Date(startDateStr) : null;
    const end = policyDates.expiryDate ? new Date(policyDates.expiryDate) : null;
    const inWindow = start && end ? now >= start && now <= end : false;

    if (policyStatus === 'ACTIVE' && inWindow) {
      coverageStatus = 'active';
      coverageReason = 'graphql_active_in_window';
      console.log('✅ Coverage active via GraphQL policy in valid window');
    } else if (policyStatus === 'DRAFT' && inWindow) {
      coverageStatus = 'active';
      coverageReason = 'graphql_draft_in_window';
      console.log('✅ Coverage active via GraphQL DRAFT in valid window');
    } else if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatus || '')) {
      coverageStatus = 'inactive';
      coverageReason = 'graphql_inactive_status';
      console.log('❌ Inactive via GraphQL policy status:', policyStatus);
    } else if (['READY', 'PENDING', 'DRAFT'].includes(policyStatus || '')) {
      coverageStatus = 'pending';
      coverageReason = 'graphql_pending_status';
      console.log('⏳ Pending via GraphQL policy status:', policyStatus);
    } else {
      // Fallback to Supabase (contracts stored)
      if (groupId && contractDataForResponse.entry && contractDataForResponse.entry.length > 0) {
        console.log('✅ FAMILY HAS ACTIVE CONTRACT (fallback)');
        coverageStatus = 'active';
        coverageReason = 'fallback_active_contract';
      } else {
        console.log('❌ FAMILY HAS NO ACTIVE CONTRACT (fallback)');
        coverageStatus = 'inactive';
        coverageReason = 'fallback_no_contract';
      }
    }

    console.log('\n📊 Final coverage status:', coverageStatus.toUpperCase());

    const fullName = patient.name?.[0]
      ? `${patient.name[0].given?.[0] || ''} ${patient.name[0].family || ''}`.trim()
      : 'Unknown';

    return new Response(
      JSON.stringify({
        exists: true,
        patientData,
        coverageData,
        contractData: contractDataForResponse,
        insurancePlanData,
        invoicesData,
        totalUnpaidAmount,
        fullName,
        coverageStatus,
        coverageReason,
        policyStatus,
        policyDates,
        policyData,
        policyErrorText,
        groupId,
        familyUuidUsed: familyUuidForGraphQL,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
