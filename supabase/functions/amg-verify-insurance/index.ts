import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    // Call AMG API to search for patient with this insurance number
    const patientResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Patient/?identifier=${insuranceNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!patientResponse.ok) {
      console.error('AMG API error:', patientResponse.status);
      return new Response(
        JSON.stringify({ error: 'Failed to verify insurance number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patientData = await patientResponse.json();
    console.log('Patient data:', patientData);

    // Check if patient exists
    if (!patientData.entry || patientData.entry.length === 0) {
      return new Response(
        JSON.stringify({ exists: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const patient: PatientResource = patientData.entry[0].resource;
    
    // Get patient name
    const fullName = patient.name?.[0]
      ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
      : '';

    // Get coverage information
    const coverageResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/Coverage/?beneficiary=Patient/${patient.id}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    let coverageData = null;
    if (coverageResponse.ok) {
      coverageData = await coverageResponse.json();
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
