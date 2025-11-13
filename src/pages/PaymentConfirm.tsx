import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const PaymentConfirm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const operator = searchParams.get("operator") || "holo";
  const [isProcessing, setIsProcessing] = useState(false);
  const insuranceNumber = localStorage.getItem("insuranceNumber") || "AMG-2025-001245";

  const operatorNames: Record<string, string> = {
    holo: "HOLO",
  };

  const handleConfirm = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Simulate 80% success rate
      const isSuccess = Math.random() > 0.2;
      navigate(`/payment-result?status=${isSuccess ? "success" : "failed"}&operator=${operator}`);
    }, 2000);
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
            <span className="text-3xl font-bold bg-gradient-to-r from-primary to-turquoise bg-clip-text text-transparent">3 000 KMF</span>
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
          En confirmant, vous acceptez le prélèvement de 3 000 KMF
        </p>
      </div>
    </div>
  );
};

export default PaymentConfirm;
