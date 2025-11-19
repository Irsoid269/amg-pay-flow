import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

interface PatientResource {
  resourceType: string;
  id: string;
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
  extension?: any[];
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
    const loginResponse = await fetch('https://test.amg.km/api/api_fhir_r4/login/', {
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

    // Step 2: Get patient directly by ID
    const patientResponse = await fetch(
      `https://test.amg.km/api/api_fhir_r4/Patient/${insuranceNumber}`,
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
      console.error('Patient fetch failed:', patientResponse.status, errorText);
      if (patientResponse.status === 404) {
        return new Response(JSON.stringify({ exists: false }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Failed to get patient' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const patientData: PatientResource = await patientResponse.json();
    if (patientData.resourceType !== 'Patient') {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fullName = patientData.name?.[0]
      ? `${patientData.name[0].given?.[0] || ''} ${patientData.name[0].family || ''}`.trim()
      : 'Unknown';

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

    // Extract Group/Family ID from patient extensions
    const groupExtension = patientData.extension?.find(
      (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/patient-group-reference'
    );
    const groupId = groupExtension?.valueReference?.identifier?.value;
    const referenceStr: string | undefined = groupExtension?.valueReference?.reference;
    const extractedUuid = referenceStr ? (referenceStr.includes('/') ? referenceStr.split('/')[1] : referenceStr) : undefined;
    // Try to derive the true GraphQL familyUuid from the FHIR Group resource
    let familyUuidForGraphQL: string | null = extractedUuid || groupId || null;
    try {
      const groupResourceId = extractedUuid || groupId;
      if (groupResourceId) {
      const groupResp = await fetch(`https://test.amg.km/api/api_fhir_r4/Group/${groupResourceId}`, {
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
            // As a last resort, use the Group resource id
            familyUuidForGraphQL = groupJson.id;
          }
        }
      }
    } catch (_) {
      // Ignore group fetch errors; we'll keep fallback
    }

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
        const graphQLResponse = await fetch('https://test.amg.km/api/graphql', {
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
          } else {
            // Capture diagnostic details when no policy is found
            policyErrorText = JSON.stringify({
              message: 'No policy found for familyUuid',
              familyUuid: familyUuidForGraphQL,
              response: gql,
            });
          }
        } else {
          const errText = await graphQLResponse.text();
          policyErrorText = errText;
        }
      } catch (e) {
        policyErrorText = e instanceof Error ? e.message : String(e);
      }
    }

    // Fallback: try FHIR Coverage if no policy data from GraphQL
    if (!policyStatus && (!policyDates.startDate && !policyDates.effectiveDate && !policyDates.expiryDate)) {
      try {
        const coverageResp = await fetch(
      `https://test.amg.km/api/api_fhir_r4/Coverage?beneficiary=Patient/${patientData.id}`,
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

    // Compute coverage from GraphQL policy or FHIR Coverage
    let coverageStatusGraphQL: 'active' | 'pending' | 'inactive' | 'unknown' = 'unknown';
    let coverageReasonGraphQL: string = 'unknown';
    const now = new Date();
    const startDateStr = policyDates.startDate || policyDates.effectiveDate;
    const start = startDateStr ? new Date(startDateStr) : null;
    const end = policyDates.expiryDate ? new Date(policyDates.expiryDate) : null;
    const inWindow = start && end ? now >= start && now <= end : false;

    if (policyStatus === 'ACTIVE' && inWindow) {
      coverageStatusGraphQL = 'active';
      coverageReasonGraphQL = start && end ? 'graphql_active_in_window' : 'fhir_coverage_active';
    } else if (policyStatus === 'DRAFT' && inWindow) {
      coverageStatusGraphQL = 'active';
      coverageReasonGraphQL = 'graphql_draft_in_window';
    } else if (['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(policyStatus || '')) {
      coverageStatusGraphQL = 'inactive';
      coverageReasonGraphQL = 'graphql_inactive_status';
    } else if (['READY', 'PENDING', 'DRAFT'].includes(policyStatus || '')) {
      coverageStatusGraphQL = 'pending';
      coverageReasonGraphQL = 'graphql_pending_status';
    }

      return new Response(
        JSON.stringify({
          exists: true,
          fullName,
          patientId: patientData.id,
          groupId,
          familyUuidUsed: familyUuidForGraphQL,
          groupReference: referenceStr,
          groupIdentifier: groupId,
          policyStatus,
          policyDates,
          policyData,
          coverageStatusGraphQL,
          coverageReasonGraphQL,
          policyErrorText,
        }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});