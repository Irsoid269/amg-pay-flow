import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Smartphone } from "lucide-react";

const operators = [
  {
    id: "holo",
    name: "HOLO",
    color: "holo",
    description: "USSD / Application mobile",
    logo: "🟢",
  },
  {
    id: "huri",
    name: "HURI",
    color: "huri",
    description: "USSD / Application mobile",
    logo: "🟣",
  },
  {
    id: "mvola",
    name: "MVOLA",
    color: "mvola",
    description: "USSD / Application mobile",
    logo: "🟠",
  },
];

const PaymentMethod = () => {
  const navigate = useNavigate();

  const handleSelectOperator = (operatorId: string) => {
    navigate(`/payment-confirm?operator=${operatorId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10 mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Choisissez votre opérateur</h1>
          <p className="text-primary-foreground/80 mt-2">
            Sélectionnez votre opérateur de paiement mobile
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-4">
        {operators.map((operator) => (
          <Card
            key={operator.id}
            className="p-6 hover:shadow-lg transition-all cursor-pointer animate-scale-in"
            onClick={() => handleSelectOperator(operator.id)}
          >
            <div className="flex items-center gap-4">
              <div className="text-5xl">{operator.logo}</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{operator.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Smartphone className="w-4 h-4" />
                  {operator.description}
                </div>
              </div>
              <div className="text-muted-foreground">→</div>
            </div>
          </Card>
        ))}

        <Card className="p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground">
            💡 Vous serez redirigé vers votre opérateur pour confirmer le paiement
          </p>
        </Card>
      </div>
    </div>
  );
};

export default PaymentMethod;
