import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration HOLO - À VÉRIFIER avec votre administrateur HOLO
// L'URL doit correspondre à votre environnement HOLO (test ou production)
// Le Merchant ID et l'IP de votre application doivent être configurés dans HOLO
const HOLO_API_URL = 'https://26900.tagpay.fr/online/online.php';
const MERCHANT_ID = '2006214794279291';

// Mode test pour développement (à désactiver en production)
const TEST_MODE = true;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, insuranceNumber } = await req.json();
    
    console.log('Initiating HOLO payment:', { amount, insuranceNumber });

    // MODE TEST: Simuler un paiement si le Merchant ID n'est pas encore configuré
    if (TEST_MODE) {
      console.log('⚠️  MODE TEST ACTIVÉ - Simulation du paiement');
      
      const purchaseRef = `PAY-${insuranceNumber}-${Date.now()}`;
      const baseUrl = req.headers.get('origin') || 'https://id-preview--a3834d89-e8f2-4331-af08-c6853d1f5422.lovable.app';
      
      // Simuler un délai puis rediriger vers succès (80% de réussite)
      const isSuccess = Math.random() > 0.2;
      const testResultUrl = `${baseUrl}/payment-result?status=${isSuccess ? 'success' : 'failed'}&operator=holo&ref=${purchaseRef}`;
      
      return new Response(
        JSON.stringify({
          success: true,
          testMode: true,
          redirectUrl: testResultUrl,
          message: 'Mode test - Paiement simulé'
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // MODE PRODUCTION: Utiliser l'API HOLO réelle
    const sessionUrl = `${HOLO_API_URL}?merchantid=${MERCHANT_ID}`;
    console.log('Requesting session from:', sessionUrl);
    
    const sessionResponse = await fetch(sessionUrl);
    const sessionText = await sessionResponse.text();
    
    console.log('Session response:', sessionText);

    // Vérifier si la session est créée avec succès
    if (!sessionText.startsWith('OK:')) {
      console.error('❌ HOLO Configuration Error:', sessionText);
      console.error('Le Merchant ID ou l\'IP ne sont pas configurés dans HOLO');
      console.error('Veuillez contacter votre administrateur HOLO pour:');
      console.error('1. Vérifier que le Merchant ID est correct');
      console.error('2. Whitelister l\'IP de votre application');
      console.error('3. Configurer les URLs de redirection');
      
      throw new Error(`Configuration HOLO invalide: ${sessionText}. Veuillez vérifier avec votre administrateur HOLO.`);
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
