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
    
    console.log('Patient belongs to Group:', groupId);

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

    // Step 5: Get insurance plan
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

    // Determine coverage status
    console.log('\n=== DETERMINING COVERAGE STATUS FOR PATIENT', patient.id, '===');
    
    let coverageStatus = 'inactive';
    
    if (groupId && contractDataForResponse.entry && contractDataForResponse.entry.length > 0) {
      console.log('✅ FAMILY HAS ACTIVE CONTRACT');
      console.log('Patient belongs to Group/Family:', groupId);
      console.log('   → ALL FAMILY MEMBERS ARE COVERED');
      coverageStatus = 'active';
    } else {
      console.log('❌ FAMILY HAS NO ACTIVE CONTRACT');
      console.log('Patient belongs to Group/Family:', groupId);
      console.log('   → ALL FAMILY MEMBERS ARE NOT COVERED');
      console.log('   Reason: No contract found with valid period AND payment');
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
        fullName,
        coverageStatus,
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
