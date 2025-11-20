import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

const PaymentConfirm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const operator = searchParams.get("operator") || "holo";
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [insuranceNumber, setInsuranceNumber] = useState("");

  const operatorNames: Record<string, string> = {
    holo: "HOLO",
  };

  useEffect(() => {
    // Récupérer les données depuis le localStorage
    const paymentData = JSON.parse(localStorage.getItem('pendingPayment') || '{}');

    // Essayer d'obtenir le numéro d'assuré depuis amg_insurance_data puis fallback sur pendingPayment
    let storedInsuranceNumber = '';
    const insuranceDataRaw = localStorage.getItem('amg_insurance_data');
    if (insuranceDataRaw) {
      try {
        const insuranceData = JSON.parse(insuranceDataRaw);
        storedInsuranceNumber = insuranceData?.insuranceNumber || '';
      } catch (e) {
        console.warn('Impossible de parser amg_insurance_data:', e);
      }
    }

    if (!storedInsuranceNumber && paymentData?.insuranceNumber) {
      storedInsuranceNumber = paymentData.insuranceNumber;
    }

    setInsuranceNumber(storedInsuranceNumber);
    
    if (paymentData.amount) {
      setPaymentAmount(new Intl.NumberFormat('fr-FR').format(paymentData.amount));
    }
  }, []);

  const handleConfirm = async () => {
    setIsProcessing(true);
    
    try {
      // Récupérer les données de paiement depuis le localStorage
      const paymentDetails = JSON.parse(localStorage.getItem('pendingPayment') || '{}');
      // Utiliser le numéro d'assuré déjà déterminé
      const insuredRef = insuranceNumber || paymentDetails?.insuranceNumber || '';
      // Assainir le montant: utiliser la valeur numérique ou parser l'affichage
      const parsedDisplayAmount = parseFloat(String(paymentAmount).replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.'));
      const amountNum = Number(paymentDetails.amount) || (isNaN(parsedDisplayAmount) ? 0 : parsedDisplayAmount);
      if (!amountNum || amountNum <= 0) {
        throw new Error('amount must be > 0');
      }
      
      // Appeler l'endpoint serveur (préférence via VITE_API_BASE_URL)
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const url = apiBase ? `${apiBase}/api/holo/init-payment` : '/api/holo/init-payment';
      let data: any = null;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum, insuranceNumber: insuredRef, operator: 'holo' })
      });
      data = await resp.json();
      
      if (data.success) {
        // Mode test: Redirection directe
        if (data.testMode) {
          console.log('Mode test: Simulation du paiement');
          setTimeout(() => {
            window.location.href = data.redirectUrl;
          }, 2000);
          return;
        }
        
        // Mode production: Créer et soumettre le formulaire POST vers HOLO
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.paymentUrl;
        
        // Ajouter tous les champs cachés (supporte paymentData ou paymentParams)
        const params = data.paymentData || data.paymentParams || {};
        Object.entries(params).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });
        
        document.body.appendChild(form);
        form.submit();
      } else {
        console.error('Payment init failed:', data.error);
        setIsProcessing(false);
        alert(data.error || 'Échec de l\'initialisation du paiement.');
        navigate(`/payment-result?status=failed&operator=${operator}`);
        return;
      }
      
    } catch (error) {
      console.error('Payment error:', error);
      setIsProcessing(false);
      navigate(`/payment-result?status=failed&operator=${operator}`);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-turquoise/5 rounded-full blur-3xl arc-shape" />
      
      <div className="gradient-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/payment-method")}
            className="text-primary-foreground hover:bg-turquoise/20 mb-4 -ml-2 rounded-full"
            disabled={isProcessing}
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold mb-2">Confirmation du paiement</h1>
          <p className="text-primary-foreground/90 text-sm">
            Vérifiez les informations avant de confirmer
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6 relative z-10">
        <Card className="p-6 space-y-4 animate-scale-in border-2 border-turquoise/20 rounded-2xl shadow-turquoise">
          <div className="flex items-center justify-between py-4 border-b-2 border-turquoise/20">
            <span className="text-muted-foreground font-medium">Montant</span>
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-turquoise bg-clip-text text-transparent">
              {paymentAmount} KMF
            </span>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-border">
            <span className="text-muted-foreground font-medium">Opérateur</span>
            <span className="font-bold text-lg text-primary">{operatorNames[operator]}</span>
          </div>

          <div className="flex items-center justify-between py-4 border-b border-border">
            <span className="text-muted-foreground font-medium">Référence</span>
            <span className="font-mono text-sm font-semibold text-primary">{insuranceNumber}</span>
          </div>

          <div className="flex items-center justify-between py-4">
            <span className="text-muted-foreground font-medium">Bénéficiaire</span>
            <span className="font-bold text-primary">AMG Comores</span>
          </div>
        </Card>

        <Card className="p-5 bg-turquoise/5 border-2 border-turquoise/20 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-turquoise/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-turquoise" />
            </div>
            <div>
              <p className="font-bold text-sm mb-2 text-foreground">Activation automatique</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vos droits AMG seront activés immédiatement après confirmation du paiement.
              </p>
            </div>
          </div>
        </Card>

        <Button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="w-full h-16 text-lg font-bold gradient-turquoise hover:shadow-turquoise transition-all duration-300 rounded-2xl"
          size="lg"
        >
          {isProcessing ? (
            <span className="flex items-center gap-3">
              <span className="animate-spin text-2xl">⏳</span>
              <span>Paiement en cours...</span>
            </span>
          ) : (
            "Confirmer le paiement"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground font-medium">
          En confirmant, vous acceptez le prélèvement de {paymentAmount} KMF
        </p>
      </div>
    </div>
  );
};

export default PaymentConfirm;
