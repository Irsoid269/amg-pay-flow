import "https://deno.land/x/xhr@0.1.0/mod.ts";

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

    // Step 4: PAGINATION LIMITÉE - 10 pages max pour éviter timeout client
    console.log(`\n🔍 Starting pagination to find contract for Group ${groupId}...`);
    
    let selectedContract = null;
    let currentUrl: string | null = `https://dev.amg.km/api/api_fhir_r4/Contract/?_count=1000&_sort=-_lastUpdated`;
    let pageNumber = 1;
    let totalContractsScanned = 0;
    let totalContracts = 0;
    let foundGroupContract = false;
    const MAX_PAGES = 10; // Limite à 10 pages (10,000 contrats) pour éviter timeout client
    
    while (currentUrl && !foundGroupContract && pageNumber <= MAX_PAGES) {
      console.log(`\n📄 Page ${pageNumber}/${MAX_PAGES}: Fetching contracts...`);
      
      const contractResponse: Response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (!contractResponse.ok) {
        console.log(`❌ Contract API request failed: ${contractResponse.status}`);
        break;
      }
      
      const contractData: any = await contractResponse.json();
      const contractsInPage = contractData.entry?.length || 0;
      totalContractsScanned += contractsInPage;
      totalContracts = contractData.total || 0;
      
      console.log(`✅ Page ${pageNumber}: Retrieved ${contractsInPage} contracts`);
      console.log(`📊 Progress: ${totalContractsScanned} / ${totalContracts} (${Math.round(totalContractsScanned/totalContracts*100)}%)`);
      
      // Search for active contracts in this page
      if (contractData.entry && contractData.entry.length > 0) {
        const activeContracts = contractData.entry.filter((entry: any) => {
          const contract = entry.resource;
          const contractSubject = contract.subject?.[0]?.reference || '';
          
          if (!contractSubject.includes(groupId)) {
            return false;
          }
          
          const period = contract.term?.[0]?.asset?.[0]?.period?.[0];
          let periodValid = false;
          if (period) {
            const now = new Date();
            const start = new Date(period.start);
            const end = new Date(period.end);
            periodValid = now >= start && now <= end;
          }
          
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
          
          return periodValid && hasPayment;
        });
        
        if (activeContracts.length > 0) {
          console.log(`✅ FOUND ${activeContracts.length} active contract(s) for Group ${groupId}!`);
          selectedContract = activeContracts[0];
          foundGroupContract = true;
          break;
        }
      }
      
      // Get next page URL
      const nextLink: any = contractData.link?.find((link: any) => link.relation === 'next');
      if (nextLink) {
        currentUrl = decodeURIComponent(nextLink.url).replace(/^https%3A%2F%2F/, 'https://');
        pageNumber++;
      } else {
        console.log(`📍 Reached end of pagination`);
        currentUrl = null;
      }
    }
    
    if (pageNumber > MAX_PAGES) {
      console.log(`⚠️ Reached page limit (${MAX_PAGES} pages, ${totalContractsScanned} contracts scanned)`);
      console.log(`   Contract may exist but wasn't found in recent contracts`);
    }
    
    console.log(`\n📊 Pagination complete: Scanned ${totalContractsScanned} / ${totalContracts} contracts`);
    
    const contractDataForResponse = selectedContract ? { entry: [selectedContract] } : { entry: [] };

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
