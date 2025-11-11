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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center mb-6">
            <img src={logoAmg} alt="Logo AMG" className="w-48 h-auto" />
          </div>
          <p className="text-sm text-muted-foreground">openIMIS Comores</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="insurance" className="text-sm font-medium text-foreground">
              Numéro d'assurance
            </label>
            <Input
              id="insurance"
              type="text"
              placeholder="Ex: AMG-2025-001245"
              value={insuranceNumber}
              onChange={(e) => setInsuranceNumber(e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Utilisez votre numéro d'assurance AMG pour accéder à votre espace
        </p>
      </div>
    </div>
  );
};

export default Login;
