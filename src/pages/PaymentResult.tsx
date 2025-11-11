import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Home } from "lucide-react";
import { useEffect } from "react";

const PaymentResult = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status") || "success";
  const operator = searchParams.get("operator") || "holo";
  const isSuccess = status === "success";

  const operatorNames: Record<string, string> = {
    holo: "HOLO",
    huri: "HURI",
    mvola: "MVOLA",
  };

  useEffect(() => {
    if (isSuccess) {
      // Store payment success in localStorage
      const payments = JSON.parse(localStorage.getItem("payments") || "[]");
      payments.unshift({
        id: Date.now(),
        operator: operatorNames[operator],
        amount: "3 000 KMF",
        date: new Date().toLocaleDateString("fr-FR"),
        status: "success",
      });
      localStorage.setItem("payments", JSON.stringify(payments));
    }
  }, [isSuccess, operator]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-turquoise/5 rounded-full blur-3xl arc-shape" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl arc-shape" />
      </div>
      
      <div className="max-w-md w-full space-y-6 animate-scale-in relative z-10">
        <Card className={`p-10 text-center space-y-8 border-4 rounded-3xl shadow-2xl ${
          isSuccess ? "border-turquoise bg-gradient-to-b from-turquoise/5 to-white" : "border-destructive/50 bg-white"
        }`}>
          <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full ${
            isSuccess ? "bg-turquoise/20 shadow-turquoise" : "bg-destructive/10"
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-16 h-16 text-turquoise" />
            ) : (
              <XCircle className="w-16 h-16 text-destructive" />
            )}
          </div>

          <div className="space-y-3">
            <h1 className={`text-3xl font-bold ${isSuccess ? "text-turquoise" : "text-destructive"}`}>
              {isSuccess ? "Paiement réussi !" : "Paiement échoué"}
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              {isSuccess
                ? "Vos droits AMG sont activés"
                : "Solde insuffisant ou erreur réseau"}
            </p>
          </div>

          {isSuccess && (
            <div className="space-y-3 pt-6 border-t-2 border-turquoise/20">
              <div className="flex items-center justify-between p-3 bg-turquoise/5 rounded-xl">
                <span className="text-sm text-muted-foreground font-medium">Référence</span>
                <span className="font-mono font-bold text-primary">
                  {localStorage.getItem("insuranceNumber")}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-turquoise/5 rounded-xl">
                <span className="text-sm text-muted-foreground font-medium">Date</span>
                <span className="font-semibold text-primary">{new Date().toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-turquoise/5 rounded-xl">
                <span className="text-sm text-muted-foreground font-medium">Opérateur</span>
                <span className="font-bold text-primary">{operatorNames[operator]}</span>
              </div>
            </div>
          )}

          {!isSuccess && (
            <div className="space-y-4 pt-6 border-t border-border">
              <p className="text-sm font-semibold text-foreground">
                Raisons possibles :
              </p>
              <ul className="text-sm text-left space-y-3 text-muted-foreground bg-muted/30 p-4 rounded-xl">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Solde insuffisant sur votre compte</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Problème de connexion réseau</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Service temporairement indisponible</span>
                </li>
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/dashboard")}
            className={`w-full h-16 text-lg font-bold rounded-2xl transition-all duration-300 ${
              isSuccess 
                ? "gradient-turquoise hover:shadow-turquoise" 
                : "border-2 border-turquoise/30 hover:bg-turquoise/5"
            }`}
            variant={isSuccess ? "default" : "outline"}
          >
            <Home className="mr-3 h-6 w-6" />
            Retour à l'accueil
          </Button>

          {!isSuccess && (
            <Button
              onClick={() => navigate("/payment-method")}
              className="w-full h-16 text-lg font-bold gradient-turquoise hover:shadow-turquoise rounded-2xl"
            >
              Réessayer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentResult;
