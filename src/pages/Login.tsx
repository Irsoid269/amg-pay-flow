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
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-turquoise/10 rounded-full blur-3xl arc-shape" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl arc-shape" />
      </div>
      
      <div className="w-full max-w-md space-y-8 animate-fade-in relative z-10">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 bg-turquoise/20 rounded-full blur-2xl scale-110" />
            <img src={logoAmg} alt="Logo AMG" className="w-56 h-auto relative z-10 drop-shadow-lg" />
          </div>
          <p className="text-sm text-primary-foreground/80 font-medium">openIMIS Comores</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-lg backdrop-blur-sm border border-turquoise/20">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="insurance" className="text-sm font-semibold text-foreground">
                Numéro d'assurance
              </label>
              <Input
                id="insurance"
                type="text"
                placeholder="Ex: AMG-2025-001245"
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                className="h-14 text-base border-2 border-turquoise/30 focus:border-turquoise rounded-xl"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14 text-base font-bold gradient-turquoise hover:shadow-turquoise transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Utilisez votre numéro d'assurance AMG pour accéder à votre espace
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
