import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // HOLO envoie les paramètres via GET
    const url = new URL(req.url);
    const purchaseref = url.searchParams.get('purchaseref');
    const amount = url.searchParams.get('amount');
    const currency = url.searchParams.get('currency');
    const status = url.searchParams.get('status');
    const clientid = url.searchParams.get('clientid');

    console.log('HOLO notification received:', {
      purchaseref,
      amount,
      currency,
      status,
      clientid
    });

    // Ici, vous pouvez enregistrer le paiement dans votre base de données
    // ou effectuer d'autres actions selon le statut
    
    if (status === 'OK') {
      console.log(`Payment successful for reference: ${purchaseref}`);
      // Logique de traitement pour paiement réussi
    } else {
      console.log(`Payment failed/cancelled for reference: ${purchaseref}`);
      // Logique de traitement pour paiement échoué/annulé
    }

    // Retourner une réponse simple à HOLO
    return new Response(
      'OK',
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/plain' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in holo-notification:', error);
    return new Response(
      'ERROR',
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/plain' 
        } 
      }
    );
  }
});
