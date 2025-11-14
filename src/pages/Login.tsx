import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logoAmg from "@/assets/logo-amg.png";

const Login = () => {
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('Verifying insurance number with AMG API...');
      
      // Appel à l'edge function pour vérifier le numéro d'assurance
      const { data, error } = await supabase.functions.invoke('amg-verify-insurance', {
        body: { insuranceNumber },
      });

      if (error) {
        console.error('Edge function error:', error);
        toast({
          title: "Erreur",
          description: "Impossible de vérifier le numéro d'assurance",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Check if the edge function returned an error in the data
      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        toast({
          title: "Erreur",
          description: "Impossible de vérifier le numéro d'assurance",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!data || !data.exists) {
        toast({
          title: "Numéro introuvable",
          description: "Ce numéro d'assurance n'existe pas dans notre système",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Si l'assuré existe, on stocke les données et on redirige directement
      console.log('Assuré trouvé:', data.fullName, '- Numéro:', insuranceNumber);
      console.log('=== DONNÉES REÇUES DE L\'API AMG ===');
      console.log('Patient:', data.patientData?.id);
      console.log('Contract:', data.contractData?.entry?.length || 0, 'entrée(s)');
      console.log('Coverage:', data.coverageData?.entry?.length || 0, 'entrée(s)');
      console.log('Insurance Plan:', data.insurancePlanData?.entry?.length || 0, 'entrée(s)');
      
      // IMPORTANT: Vider l'ancien cache avant de stocker les nouvelles données
      localStorage.removeItem('amg_insurance_data');
      
      // Stocker les NOUVELLES données de l'assuré dans le localStorage
      const insuranceData = {
        insuranceNumber,
        fullName: data.fullName,
        patientData: data.patientData,
        coverageData: data.coverageData,
        contractData: data.contractData,
        insurancePlanData: data.insurancePlanData,
        timestamp: Date.now(),
      };
      
      localStorage.setItem('amg_insurance_data', JSON.stringify(insuranceData));
      console.log('✅ Données AMG stockées pour', data.fullName);

      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${data.fullName}`,
      });

      // Redirection immédiate vers le dashboard
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la connexion",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-secondary">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-6">
          <img src={logoAmg} alt="Logo AMG" className="w-56 h-auto mx-auto" />
          <p className="text-sm text-muted-foreground">openIMIS Comores</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-lg border">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="insurance" className="text-sm font-semibold">
                Numéro d'assurance
              </label>
              <Input
                id="insurance"
                type="text"
                placeholder="Ex: AMG-2025-001245"
                value={insuranceNumber}
                onChange={(e) => setInsuranceNumber(e.target.value)}
                className="h-14"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-14"
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
