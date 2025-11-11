import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, History, Shield, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Ahmed Mohamed");
  const insuranceNumber = localStorage.getItem("insuranceNumber") || "AMG-2025-001245";

  useEffect(() => {
    if (!localStorage.getItem("insuranceNumber")) {
      navigate("/");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6 pb-24">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Shield className="w-8 h-8" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("insuranceNumber");
                navigate("/");
              }}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              Déconnexion
            </Button>
          </div>
          <h1 className="text-2xl font-bold mb-1">Bonjour, {userName} 👋</h1>
          <p className="text-primary-foreground/80 text-sm">Bienvenue sur votre espace AMG</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-16 pb-8 space-y-4">
        <Card className="p-6 shadow-lg animate-scale-in">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Numéro d'assurance</p>
                <p className="text-lg font-semibold">{insuranceNumber}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 text-warning text-sm">
                <AlertCircle className="w-4 h-4" />
                Inactif
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
              <p className="text-3xl font-bold text-primary">3 000 KMF</p>
              <p className="text-sm text-muted-foreground mt-1">Cotisation mensuelle</p>
            </div>

            <div className="pt-2">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Couverture inactive - En attente de paiement
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/payment-method")}
            className="w-full h-14 text-base font-semibold shadow-lg"
            size="lg"
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Payer ma cotisation
          </Button>

          <Button
            onClick={() => navigate("/history")}
            variant="outline"
            className="w-full h-14 text-base font-semibold"
            size="lg"
          >
            <History className="mr-2 h-5 w-5" />
            Historique des paiements
          </Button>
        </div>

        <Card className="p-4 bg-accent/5 border-accent/20">
          <p className="text-sm text-accent-foreground font-medium mb-2">
            ℹ️ Informations importantes
          </p>
          <p className="text-sm text-muted-foreground">
            Vos droits AMG seront activés immédiatement après confirmation du paiement.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
