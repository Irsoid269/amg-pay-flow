import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration HOLO / Proxy
// Le Merchant ID et les URLs doivent être configurés dans HOLO
// Pour éviter le whitelist IP côté Supabase, on passe par un proxy serveur AMG
const HOLO_API_URL = 'https://26900.tagpay.fr/online/online.php';
const MERCHANT_ID = '2449462108576891';
// Endpoint proxy côté AMG qui initialise la session HOLO en appelant HOLO depuis l'IP whitelister (3.6.76.175)
// Attendu: soit JSON { success: true, sessionid: string } soit texte "OK:<sessionid>"
const PROXY_INIT_URL = 'https://dev.amg.km/holo/init';

// Mode test pour développement (à désactiver en production)
// Basculez à false pour rediriger vers la page HOLO réelle
const TEST_MODE = false;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, insuranceNumber } = await req.json();
    // Obtenir l'adresse IP publique du serveur (utile pour whitelist HOLO)
    let serverIp = 'unknown';
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipJson = await ipRes.json();
      serverIp = ipJson?.ip || serverIp;
    } catch (_) {
      // ignore
    }
    
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
          serverIp,
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

    // MODE PRODUCTION via PROXY: demander la session HOLO au serveur AMG (IP whitelister)
    console.log('Requesting session via proxy:', PROXY_INIT_URL);
    let sessionId = '';
    try {
      const proxyRes = await fetch(PROXY_INIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantid: MERCHANT_ID })
      });

      const contentType = proxyRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await proxyRes.json();
        if (json?.success && typeof json?.sessionid === 'string' && json.sessionid.length > 0) {
          sessionId = json.sessionid;
        } else {
          const err = json?.error || 'Réponse JSON proxy invalide';
          throw new Error(err);
        }
      } else {
        const text = await proxyRes.text();
        console.log('Proxy response (text):', text);
        if (text.startsWith('OK:')) {
          sessionId = text.substring(3).trim();
        } else {
          throw new Error(`Réponse proxy non OK: ${text}`);
        }
      }
    } catch (e) {
      console.error('❌ Proxy HOLO init error:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erreur d'initialisation via proxy: ${e instanceof Error ? e.message : 'inconnue'}`,
          details: 'Vérifiez que l\'endpoint https://dev.amg.km/holo/init existe et appelle HOLO avec merchantid.',
          serverIp,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Générer une référence unique pour la transaction
    const purchaseRef = `PAY-${insuranceNumber}-${Date.now()}`;
    
    // L'URL de base de l'application (non utilisé pour les URLs HOLO car elles sont fournies par dev.amg.km)
    const baseUrl = req.headers.get('origin') || 'https://id-preview--a3834d89-e8f2-4331-af08-c6853d1f5422.lovable.app';
    
    // Préparer les paramètres pour le formulaire HOLO
    const paymentData = {
      sessionid: sessionId,
      merchantid: MERCHANT_ID,
      amount: Math.round(amount * 100).toString(), // Montant en centimes
      currency: 'KMF',
      purchaseref: purchaseRef,
      // URLs fournies par votre configuration HOLO (environnement DEV)
      accepturl: 'https://dev.amg.km/holo/acceptpaiement',
      declineurl: 'https://dev.amg.km/holo/declinepaiement',
      cancelurl: 'https://dev.amg.km/holo/cancelpaiement',
      // URL de notification (serveur à serveur) pour la confirmation du paiement
      notifyurl: 'https://dev.amg.km/holo/notificationpaiement',
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
