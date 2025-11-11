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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 animate-scale-in">
        <Card className={`p-8 text-center space-y-6 ${isSuccess ? "border-accent" : "border-destructive"}`}>
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${
            isSuccess ? "bg-accent/10" : "bg-destructive/10"
          }`}>
            {isSuccess ? (
              <CheckCircle2 className="w-12 h-12 text-accent" />
            ) : (
              <XCircle className="w-12 h-12 text-destructive" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {isSuccess ? "Paiement réussi !" : "Paiement échoué"}
            </h1>
            <p className="text-muted-foreground">
              {isSuccess
                ? "Vos droits AMG sont activés"
                : "Solde insuffisant ou erreur réseau"}
            </p>
          </div>

          {isSuccess && (
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Référence</span>
                <span className="font-mono">
                  {localStorage.getItem("insuranceNumber")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date().toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Opérateur</span>
                <span>{operatorNames[operator]}</span>
              </div>
            </div>
          )}

          {!isSuccess && (
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Raisons possibles :
              </p>
              <ul className="text-sm text-left space-y-2 text-muted-foreground">
                <li>• Solde insuffisant sur votre compte</li>
                <li>• Problème de connexion réseau</li>
                <li>• Service temporairement indisponible</li>
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/dashboard")}
            className="w-full h-12 text-base font-semibold"
            variant={isSuccess ? "default" : "outline"}
          >
            <Home className="mr-2 h-5 w-5" />
            Retour à l'accueil
          </Button>

          {!isSuccess && (
            <Button
              onClick={() => navigate("/payment-method")}
              className="w-full h-12 text-base font-semibold"
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
