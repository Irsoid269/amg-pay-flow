import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Fetching payment history for patient:', insuranceNumber);

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

    console.log('Authentication successful');

    // Step 2: Resolve patient and family group
    console.log('Fetching patient and family group...');
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

    let patientId = insuranceNumber;
    let groupResourceId: string | undefined = undefined;

    if (patientResponse.ok) {
      const patientJson = await patientResponse.json();
      patientId = patientJson?.id || insuranceNumber;
      const groupExtension = patientJson?.extension?.find(
        (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/patient-group-reference'
      );
      const groupId = groupExtension?.valueReference?.identifier?.value;
      const referenceStr: string | undefined = groupExtension?.valueReference?.reference;
      const extractedUuid = referenceStr ? (referenceStr.includes('/') ? referenceStr.split('/')[1] : referenceStr) : undefined;
      groupResourceId = extractedUuid || groupId || undefined;
      console.log('Patient resolved:', patientId, '| Group:', groupResourceId);
    } else {
      console.warn('Patient fetch failed; proceeding with direct insuranceNumber as Patient ID');
    }

    // Step 3: Collect patient IDs (insured + family members if group available)
    const targetPatientIds: string[] = [];
    const pushUnique = (id?: string) => {
      if (!id) return;
      if (!targetPatientIds.includes(id)) targetPatientIds.push(id);
    };
    pushUnique(patientId);

    if (groupResourceId) {
      try {
        const groupResp = await fetch(
          `https://dev.amg.km/api/api_fhir_r4/Group/${groupResourceId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
            },
          }
        );
        if (groupResp.ok) {
          const groupJson = await groupResp.json();
          const members: any[] = Array.isArray(groupJson.member) ? groupJson.member : [];
          for (const m of members) {
            const ref: string | undefined = m?.entity?.reference;
            const id = ref ? (ref.includes('/') ? ref.split('/')[1] : ref) : undefined;
            pushUnique(id);
          }
          console.log('Family members resolved:', targetPatientIds);
        } else {
          console.warn('Group fetch failed:', groupResp.status);
        }
      } catch (e) {
        console.warn('Error fetching group members:', e);
      }
    }

    // Step 4: Fetch payments for all target patients
    const payments: any[] = [];
    let paymentReconciliationsAgg: any[] = [];
    let paymentNoticesAgg: any[] = [];

    for (const pid of targetPatientIds) {
      console.log('Fetching payments for Patient/', pid);
      // PaymentReconciliation
      const prResp = await fetch(
        `https://dev.amg.km/api/api_fhir_r4/PaymentReconciliation/?request=Patient/${pid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      let prJson: any = null;
      if (prResp.ok) {
        prJson = await prResp.json();
        const entries = Array.isArray(prJson.entry) ? prJson.entry : [];
        paymentReconciliationsAgg.push({ patientId: pid, data: prJson });
        for (const entry of entries) {
          const payment = entry.resource;
          payments.push({
            id: payment.id,
            type: 'reconciliation',
            status: payment.status || 'unknown',
            amount: payment.paymentAmount?.value || payment.detail?.[0]?.amount?.value || 0,
            currency: payment.paymentAmount?.currency || payment.detail?.[0]?.amount?.currency || 'KMF',
            date: payment.created || payment.period?.start || 'N/A',
            paymentIdentifier: payment.paymentIdentifier?.value || 'N/A',
            description: pid === patientId ? (payment.disposition || 'Payment reconciliation') : `Famille · ${payment.disposition || 'Payment reconciliation'}`,
            raw: payment
          });
        }
      }

      // PaymentNotice
      const pnResp = await fetch(
        `https://dev.amg.km/api/api_fhir_r4/PaymentNotice/?request=Patient/${pid}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );
      let pnJson: any = null;
      if (pnResp.ok) {
        pnJson = await pnResp.json();
        const entries = Array.isArray(pnJson.entry) ? pnJson.entry : [];
        paymentNoticesAgg.push({ patientId: pid, data: pnJson });
        for (const entry of entries) {
          const payment = entry.resource;
          payments.push({
            id: payment.id,
            type: 'notice',
            status: payment.status || 'unknown',
            amount: payment.amount?.value || 0,
            currency: payment.amount?.currency || 'KMF',
            date: payment.created || payment.payment?.date || 'N/A',
            paymentIdentifier: payment.paymentStatus?.coding?.[0]?.display || 'N/A',
            description: pid === patientId ? 'Payment notice' : 'Famille · Payment notice',
            raw: payment
          });
        }
      }
    }

    // Sort payments by date (most recent first)
    payments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`Total payments found (insured + family): ${payments.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        payments,
        paymentReconciliations: paymentReconciliationsAgg,
        paymentNotices: paymentNoticesAgg,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
