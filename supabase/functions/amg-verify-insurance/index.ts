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

    // Step 2: Search for patient with auth token
    const patientResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Patient/?identifier=${insuranceNumber}`,
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
      return new Response(
        JSON.stringify({ error: 'Failed to verify insurance number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patientData = await patientResponse.json();
    console.log('Patient data:', patientData);

    // Check if patient exists
    // The API can return either a FHIR Bundle with entry or a direct Patient resource
    let patient: PatientResource;
    
    if (patientData.resourceType === 'Patient') {
      // Direct patient resource
      patient = patientData;
    } else if (patientData.entry && patientData.entry.length > 0) {
      // FHIR Bundle format
      patient = patientData.entry[0].resource;
    } else {
      // Patient not found
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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

    return new Response(
      JSON.stringify({
        exists: true,
        patientData: patient,
        coverageData,
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
