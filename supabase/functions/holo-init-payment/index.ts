import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOLO_API_URL = 'https://26900.tagpay.fr/online/online.php';
const MERCHANT_ID = '2006214794279291';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, insuranceNumber } = await req.json();
    
    console.log('Initiating HOLO payment:', { amount, insuranceNumber });

    // Étape 1: Récupérer un session ID de HOLO
    const sessionUrl = `${HOLO_API_URL}?merchantid=${MERCHANT_ID}`;
    console.log('Requesting session from:', sessionUrl);
    
    const sessionResponse = await fetch(sessionUrl);
    const sessionText = await sessionResponse.text();
    
    console.log('Session response:', sessionText);

    // Vérifier si la session est créée avec succès
    if (!sessionText.startsWith('OK:')) {
      throw new Error(`Failed to create session: ${sessionText}`);
    }

    // Extraire le session ID (enlever "OK:")
    const sessionId = sessionText.substring(3).trim();
    
    // Générer une référence unique pour la transaction
    const purchaseRef = `PAY-${insuranceNumber}-${Date.now()}`;
    
    // L'URL de base de l'application
    const baseUrl = req.headers.get('origin') || 'https://id-preview--a3834d89-e8f2-4331-af08-c6853d1f5422.lovable.app';
    
    // Préparer les paramètres pour le formulaire HOLO
    const paymentData = {
      sessionid: sessionId,
      merchantid: MERCHANT_ID,
      amount: Math.round(amount * 100).toString(), // Montant en centimes
      currency: 'KMF',
      purchaseref: purchaseRef,
      accepturl: `${baseUrl}/payment-result?status=success&operator=holo&ref=${purchaseRef}`,
      declineurl: `${baseUrl}/payment-result?status=failed&operator=holo&ref=${purchaseRef}`,
      cancelurl: `${baseUrl}/payment-result?status=cancelled&operator=holo&ref=${purchaseRef}`,
      brand: 'AMG Insurance',
      description: `Paiement AMG - ${insuranceNumber}`,
      lang: 'fr'
    };

    console.log('Payment data prepared:', paymentData);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: HOLO_API_URL,
        paymentData,
        purchaseRef
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in holo-init-payment:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
