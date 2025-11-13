import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Smartphone } from "lucide-react";
import logoHolo from "@/assets/logo-holo.png";

const operators = [
  {
    id: "holo",
    name: "HOLO",
    color: "holo",
    description: "BDC - Mobile Banking",
    logo: logoHolo,
  },
];

const PaymentMethod = () => {
  const navigate = useNavigate();

  const handleSelectOperator = (operatorId: string) => {
    navigate(`/payment-confirm?operator=${operatorId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-turquoise/5 rounded-full blur-3xl animate-pulse-soft" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      
      <div className="gradient-primary text-primary-foreground p-6 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10" />
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-turquoise/20 mb-6 -ml-2 rounded-full transition-all hover:scale-105"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Retour
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 animate-fade-in-left">
            Choisissez votre opérateur
          </h1>
          <p className="text-primary-foreground/90 text-sm md:text-base animate-fade-in-left" style={{ animationDelay: '0.1s' }}>
            Sélectionnez HOLO pour effectuer votre paiement mobile sécurisé
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 pb-12 relative z-10">
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
          {operators.map((operator, index) => (
            <Card
              key={operator.id}
              className="group p-8 hover:shadow-turquoise transition-all duration-500 cursor-pointer animate-scale-in border-2 border-turquoise/20 hover:border-turquoise rounded-3xl overflow-hidden relative hover-lift"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => handleSelectOperator(operator.id)}
            >
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-turquoise/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative flex items-center gap-6">
                {/* Logo */}
                <div className="w-28 h-28 flex items-center justify-center bg-gradient-to-br from-primary/5 to-turquoise/5 rounded-3xl p-4 group-hover:scale-110 transition-transform duration-500">
                  <img 
                    src={operator.logo} 
                    alt={operator.name} 
                    className="w-full h-full object-contain drop-shadow-lg" 
                  />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-3 text-primary group-hover:text-turquoise transition-colors duration-300">
                    {operator.name}
                  </h3>
                  <div className="flex items-center gap-3 mb-4">
                    <Smartphone className="w-5 h-5 text-turquoise" />
                    <span className="font-semibold text-foreground">
                      {operator.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="px-3 py-1 bg-success/10 text-success rounded-full font-medium border border-success/20">
                      Paiement sécurisé
                    </span>
                    <span className="px-3 py-1 bg-turquoise/10 text-turquoise rounded-full font-medium border border-turquoise/20">
                      Activation instantanée
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-turquoise text-4xl group-hover:translate-x-2 transition-transform duration-300">
                  →
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 mt-8">
          <Card className="p-6 bg-gradient-to-br from-turquoise/5 to-transparent border-2 border-turquoise/20 rounded-2xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start gap-4">
              <span className="text-3xl">🔒</span>
              <div>
                <h4 className="font-bold text-foreground mb-1">Paiement sécurisé</h4>
                <p className="text-sm text-muted-foreground">
                  Authentification forte avec code PIN et SMS OTP
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-2 border-primary/20 rounded-2xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start gap-4">
              <span className="text-3xl">⚡</span>
              <div>
                <h4 className="font-bold text-foreground mb-1">Activation instantanée</h4>
                <p className="text-sm text-muted-foreground">
                  Vos droits AMG activés immédiatement après paiement
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethod;
