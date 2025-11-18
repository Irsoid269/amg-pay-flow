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

    // Step 2: Get PaymentReconciliation/PaymentNotice for the patient
    console.log('Fetching payment reconciliations...');
    const paymentReconciliationResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/PaymentReconciliation/?request=Patient/${insuranceNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    let paymentReconciliations = null;
    if (paymentReconciliationResponse.ok) {
      paymentReconciliations = await paymentReconciliationResponse.json();
      console.log('Payment reconciliations retrieved:', paymentReconciliations?.total || 0);
    } else {
      console.log('No payment reconciliations found or error:', paymentReconciliationResponse.status);
    }

    // Step 3: Get PaymentNotice for the patient
    console.log('Fetching payment notices...');
    const paymentNoticeResponse = await fetch(
      `https://dev.amg.km/api/api_fhir_r4/PaymentNotice/?request=Patient/${insuranceNumber}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      }
    );

    let paymentNotices = null;
    if (paymentNoticeResponse.ok) {
      paymentNotices = await paymentNoticeResponse.json();
      console.log('Payment notices retrieved:', paymentNotices?.total || 0);
    } else {
      console.log('No payment notices found or error:', paymentNoticeResponse.status);
    }

    // Step 4: Format payments for frontend
    const payments = [];

    // Process PaymentReconciliation entries
    if (paymentReconciliations?.entry) {
      for (const entry of paymentReconciliations.entry) {
        const payment = entry.resource;
        payments.push({
          id: payment.id,
          type: 'reconciliation',
          status: payment.status || 'unknown',
          amount: payment.paymentAmount?.value || payment.detail?.[0]?.amount?.value || 0,
          currency: payment.paymentAmount?.currency || payment.detail?.[0]?.amount?.currency || 'KMF',
          date: payment.created || payment.period?.start || 'N/A',
          paymentIdentifier: payment.paymentIdentifier?.value || 'N/A',
          description: payment.disposition || 'Payment reconciliation',
          raw: payment
        });
      }
    }

    // Process PaymentNotice entries
    if (paymentNotices?.entry) {
      for (const entry of paymentNotices.entry) {
        const payment = entry.resource;
        payments.push({
          id: payment.id,
          type: 'notice',
          status: payment.status || 'unknown',
          amount: payment.amount?.value || 0,
          currency: payment.amount?.currency || 'KMF',
          date: payment.created || payment.payment?.date || 'N/A',
          paymentIdentifier: payment.paymentStatus?.coding?.[0]?.display || 'N/A',
          description: 'Payment notice',
          raw: payment
        });
      }
    }

    // Sort payments by date (most recent first)
    payments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`Total payments found: ${payments.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        payments,
        paymentReconciliations,
        paymentNotices,
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
