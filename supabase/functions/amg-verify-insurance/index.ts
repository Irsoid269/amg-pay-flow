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
    // Note: Contracts are linked to Groups, not directly to Patients
    // We need to find the contract that contains this specific patient
    const contractResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Contract/?subject=Patient/${patient.id}`,
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
      console.log(`Total contracts found: ${contractData.total || 0}`);
      
      // Analyze all contracts to find the one for this specific patient
      if (contractData.entry && contractData.entry.length > 0) {
        console.log(`Analyzing ${contractData.entry.length} contracts...`);
        
        // Filter contracts that contain this patient in their typeReference
        const relevantContracts = contractData.entry.filter((entry: any) => {
          const contract = entry.resource;
          const typeReferences = contract.term?.[0]?.asset?.[0]?.typeReference || [];
          
          // Check if this patient is in the typeReference list
          const hasPatient = typeReferences.some((ref: any) => 
            ref.display === patient.id || ref.identifier?.value === patient.id
          );
          
          if (hasPatient) {
            console.log(`✓ Found contract ${contract.identifier?.[1]?.value} with status: ${contract.status}`);
          }
          
          return hasPatient;
        });
        
        console.log(`Found ${relevantContracts.length} relevant contracts for patient ${patient.id}`);
        
        if (relevantContracts.length > 0) {
          // Priority: Executed > Offered > others
          // Also prefer the most recent one
          selectedContract = relevantContracts.reduce((best: any, current: any) => {
            const currentContract = current.resource;
            const bestContract = best?.resource;
            
            if (!best) return current;
            
            const currentStatus = currentContract.status?.toLowerCase();
            const bestStatus = bestContract.status?.toLowerCase();
            
            // Executed is the highest priority (actual active coverage)
            if (currentStatus === 'executed' && bestStatus !== 'executed') {
              return current;
            }
            if (bestStatus === 'executed' && currentStatus !== 'executed') {
              return best;
            }
            
            // If both have same status priority, prefer the most recent (by date in extension)
            const currentDate = currentContract.term?.[0]?.asset?.[0]?.period?.[0]?.start;
            const bestDate = bestContract.term?.[0]?.asset?.[0]?.period?.[0]?.start;
            
            if (currentDate && bestDate && currentDate > bestDate) {
              return current;
            }
            
            return best;
          }, null);
          
          if (selectedContract) {
            const contract = selectedContract.resource;
            console.log(`✅ Selected contract: ${contract.identifier?.[1]?.value}`);
            console.log(`   Status: ${contract.status}`);
            console.log(`   Period: ${contract.term?.[0]?.asset?.[0]?.period?.[0]?.start} to ${contract.term?.[0]?.asset?.[0]?.period?.[0]?.end}`);
            
            // Replace the first entry with the selected contract
            contractData.entry = [selectedContract];
          }
        } else {
          console.log('⚠️  No contracts found that specifically reference this patient');
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
