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

    // Step 2: Get patient directly by ID (insurance number is the patient ID)
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
      
      // If patient not found (404), return exists: false instead of error
      if (patientResponse.status === 404) {
        return new Response(
          JSON.stringify({ exists: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For other errors, return 500
      return new Response(
        JSON.stringify({ error: 'Failed to verify insurance number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patientData = await patientResponse.json();
    console.log('Patient data:', patientData);

    // Check if patient exists
    // When fetching by ID, we get a direct Patient resource or an error
    if (patientData.resourceType !== 'Patient') {
      // Patient not found or error
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const patient: PatientResource = patientData;
    
    // Get patient name
    const fullName = patient.name?.[0]
      ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
      : '';

    // Step 3: Get coverage information with auth token
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
    } else {
      console.log('Coverage data not available:', coverageResponse.status);
    }

    // Step 4: Get contract/policy information to retrieve payment amount
    // IMPORTANT: Contracts in openIMIS are linked to GROUPS (families), not individual patients
    // We need to get the patient's group first, then find the contract for that group
    
    // Extract the group reference from patient data
    const groupRef = patient.extension?.find((ext: any) => 
      ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/patient-group-reference'
    )?.valueReference;
    
    const groupId = groupRef?.reference?.split('/')[1] || groupRef?.identifier?.value;
    
    console.log(`Patient belongs to Group: ${groupId}`);
    
    // Query contracts by Group with sorting and increased page size
    // Sort by _lastUpdated descending to get most recent contracts first
    const contractQueryParam = groupId 
      ? `subject=Group/${groupId}&_count=50&_sort=-_lastUpdated` 
      : `subject=Patient/${patient.id}&_count=50&_sort=-_lastUpdated`;
    
    const contractResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Contract/?${contractQueryParam}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    let contractData = null;
    let selectedContract = null;
    
    if (contractResponse.ok) {
      contractData = await contractResponse.json();
      console.log('Contract data retrieved successfully');
      console.log(`Total contracts found for ${groupId ? 'Group' : 'Patient'}: ${contractData.total || 0}`);
      
      // Analyze contracts to find the active/executed one for this group
      if (contractData.entry && contractData.entry.length > 0) {
        console.log(`Analyzing ${contractData.entry.length} contracts...`);
        
        // IMPORTANT: In openIMIS, all members of a Group are covered by the Group's contract
        // We don't need to check if the patient is in typeReference
        // We just need to find the most recent ACTIVE contract (Executed status)
        
        const activeContracts = contractData.entry.filter((entry: any) => {
          const contract = entry.resource;
          const status = contract.status?.toLowerCase();
          
          // Check if the contract is in an active state
          const isActive = status === 'executed'; // Only "Executed" means truly active
          
          if (isActive) {
            console.log(`✓ Found ACTIVE contract ${contract.identifier?.[1]?.value || contract.identifier?.[0]?.value} with status: ${contract.status}`);
            
            // Also log period info
            const period = contract.term?.[0]?.asset?.[0]?.period?.[0];
            if (period) {
              console.log(`   Period: ${period.start} to ${period.end}`);
            }
          }
          
          return isActive;
        });
        
        console.log(`Found ${activeContracts.length} ACTIVE (Executed) contracts for Group ${groupId}`);
        
        if (activeContracts.length > 0) {
          // Take the most recent active contract
          selectedContract = activeContracts.reduce((best: any, current: any) => {
            const currentContract = current.resource;
            const bestContract = best?.resource;
            
            if (!best) return current;
            
            // Prefer the most recent (by period start date)
            const currentDate = currentContract.term?.[0]?.asset?.[0]?.period?.[0]?.start;
            const bestDate = bestContract.term?.[0]?.asset?.[0]?.period?.[0]?.start;
            
            if (currentDate && bestDate && currentDate > bestDate) {
              console.log(`   Preferring more recent contract: ${currentDate} vs ${bestDate}`);
              return current;
            }
            
            return best;
          }, null);
          
          if (selectedContract) {
            const contract = selectedContract.resource;
            console.log(`✅ Selected ACTIVE contract for Group ${groupId}:`);
            console.log(`   Contract ID: ${contract.identifier?.[1]?.value || contract.identifier?.[0]?.value}`);
            console.log(`   Status: ${contract.status} (ACTIVE)`);
            console.log(`   Period: ${contract.term?.[0]?.asset?.[0]?.period?.[0]?.start} to ${contract.term?.[0]?.asset?.[0]?.period?.[0]?.end}`);
            console.log(`   Patient ${patient.id} is covered as member of Group ${groupId}`);
            
            // Replace with selected contract
            contractData.entry = [selectedContract];
          }
        } else {
          // Fallback: check for "Offered" status if no "Executed" found
          console.log('⚠️  No Executed contracts found, checking for Offered...');
          const offeredContracts = contractData.entry.filter((entry: any) => {
            const contract = entry.resource;
            return contract.status?.toLowerCase() === 'offered';
          });
          
          if (offeredContracts.length > 0) {
            console.log(`Found ${offeredContracts.length} Offered (pending) contracts`);
            selectedContract = offeredContracts[0];
            contractData.entry = [selectedContract];
          } else {
            console.log(`❌ No active or offered contracts found for Group ${groupId}`);
            console.log('   This may indicate the group has no valid insurance policy');
          }
        }
      }
    } else {
      console.log('Contract data not available:', contractResponse.status);
    }

    // Step 5: Get insurance plan information
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
        console.log('Insurance plan details:', JSON.stringify(insurancePlanData, null, 2));
      } else {
        console.log('Insurance plan data not available:', insurancePlanResponse.status);
      }
    }

    return new Response(
      JSON.stringify({
        exists: true,
        patientData: patient,
        coverageData,
        contractData,
        insurancePlanData,
        fullName,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in amg-verify-insurance:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
