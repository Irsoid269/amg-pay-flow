import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import logoAmg from "@/assets/logo-amg.png";

const Login = () => {
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate validation
    setTimeout(() => {
      if (insuranceNumber.startsWith("AMG-")) {
        toast({
          title: "Connexion réussie",
          description: "Bienvenue sur votre espace AMG",
        });
        localStorage.setItem("insuranceNumber", insuranceNumber);
        navigate("/dashboard");
      } else {
        toast({
          title: "Erreur de connexion",
          description: "Numéro d'assurance introuvable. Veuillez vérifier.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-turquoise/10 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="w-full max-w-md space-y-8 animate-scale-in relative z-10">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center mb-6 relative animate-fade-in">
            <div className="absolute inset-0 bg-turquoise/20 rounded-full blur-2xl scale-110" />
            <img src={logoAmg} alt="Logo AMG" className="w-56 h-auto relative z-10 drop-shadow-2xl" />
          </div>
          <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-3xl font-bold text-primary-foreground">Bienvenue</h1>
            <p className="text-sm text-primary-foreground/80 font-medium">AMG Comores - openIMIS</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl p-8 shadow-2xl glass-effect border-2 border-turquoise/30 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="insurance" className="text-sm font-bold text-foreground block">
                Numéro d'assurance
              </label>
              <Input
                id="insurance"
                type="text"
                placeholder="Ex: AMG-2025-001245"
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                className="h-14 text-base border-2 border-border hover:border-turquoise/50 focus:border-turquoise rounded-xl transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-base font-bold gradient-turquoise hover:shadow-turquoise transition-all duration-300 hover:scale-[1.02] rounded-xl"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Connexion...
                </span>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-turquoise/5 rounded-xl border border-turquoise/20">
            <p className="text-center text-xs text-muted-foreground leading-relaxed">
              Utilisez votre numéro d'assurance AMG pour accéder à votre espace personnel sécurisé
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-primary-foreground/60 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          Paiement mobile sécurisé • Protection santé instantanée
        </p>
      </div>
    </div>
  );
};

export default Login;
