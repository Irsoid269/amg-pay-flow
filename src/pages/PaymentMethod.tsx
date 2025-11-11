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
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-turquoise/5 rounded-full blur-3xl arc-shape" />
      
      <div className="gradient-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-turquoise/20 mb-4 -ml-2 rounded-full"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Retour
          </Button>
          <h1 className="text-3xl font-bold mb-2">Choisissez votre opérateur</h1>
          <p className="text-primary-foreground/90 text-sm">
            Sélectionnez votre opérateur de paiement mobile
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8 space-y-4 relative z-10">
        {operators.map((operator, index) => (
          <Card
            key={operator.id}
            className="p-6 hover:shadow-turquoise transition-all duration-300 cursor-pointer animate-scale-in border-2 border-turquoise/20 hover:border-turquoise rounded-2xl"
            style={{ animationDelay: `${index * 0.1}s` }}
            onClick={() => handleSelectOperator(operator.id)}
          >
            <div className="flex items-center gap-5">
              <div className="text-6xl">{operator.logo}</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2 text-primary">{operator.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Smartphone className="w-4 h-4" />
                  <span className="font-medium">{operator.description}</span>
                </div>
              </div>
              <div className="text-turquoise text-2xl">→</div>
            </div>
          </Card>
        ))}

        <Card className="p-5 bg-turquoise/5 border-2 border-turquoise/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <p className="text-sm text-muted-foreground">
              Vous serez redirigé vers votre opérateur pour confirmer le paiement de manière sécurisée
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentMethod;
