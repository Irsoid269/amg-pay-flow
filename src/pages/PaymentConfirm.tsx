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
    holo: "HOLO 🟢",
    huri: "HURI 🟣",
    mvola: "MVOLA 🟠",
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
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/payment-method")}
            className="text-primary-foreground hover:bg-primary-foreground/10 mb-4 -ml-2"
            disabled={isProcessing}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Confirmation du paiement</h1>
          <p className="text-primary-foreground/80 mt-2">
            Vérifiez les informations avant de confirmer
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <Card className="p-6 space-y-4 animate-scale-in">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Montant</span>
            <span className="text-2xl font-bold text-primary">3 000 KMF</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Opérateur</span>
            <span className="font-semibold">{operatorNames[operator]}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-muted-foreground">Référence</span>
            <span className="font-mono text-sm">{insuranceNumber}</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-muted-foreground">Bénéficiaire</span>
            <span className="font-semibold">AMG Comores</span>
          </div>
        </Card>

        <Card className="p-4 bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Activation automatique</p>
              <p className="text-sm text-muted-foreground">
                Vos droits AMG seront activés immédiatement après confirmation du paiement.
              </p>
            </div>
          </div>
        </Card>

        <Button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="w-full h-14 text-base font-semibold shadow-lg"
          size="lg"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Paiement en cours...
            </span>
          ) : (
            "Confirmer le paiement"
          )}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          En confirmant, vous acceptez le prélèvement de 3 000 KMF
        </p>
      </div>
    </div>
  );
};

export default PaymentConfirm;
