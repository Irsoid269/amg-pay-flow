import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      
      // Commutateur pour fonctions locales (sans modifier le client Supabase auto-généré)
      const useLocalFns = import.meta.env.VITE_USE_LOCAL_FUNCTIONS === 'true';
      const localFnsUrl = import.meta.env.VITE_LOCAL_FUNCTIONS_URL || 'http://localhost:54321/functions/v1';

      let data: any = null;
      let invocationError: any = null;

      if (useLocalFns) {
        try {
          const resp = await fetch(`${localFnsUrl}/amg-verify-insurance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ insuranceNumber }),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            console.error('Local function call failed:', resp.status, errText);
            invocationError = { message: errText, status: resp.status };
          } else {
            data = await resp.json();
          }
        } catch (err: any) {
          console.error('Local function network error:', err);
          invocationError = err;
        }
      } else {
        const { data: cloudData, error } = await supabase.functions.invoke('amg-verify-insurance', {
          body: { insuranceNumber },
        });
        data = cloudData;
        invocationError = error;
      }

      if (invocationError) {
        console.error('Edge function error:', invocationError);
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        setIsLoading(false);
        return;
      }

      if (!data || !data.exists) {
        console.warn('Insurance number not found in AMG system');
        setIsLoading(false);
        return;
      }

      console.log('Assuré trouvé:', data.fullName, '- Numéro:', insuranceNumber);
      console.group('amg-verify-insurance: résultat');
      console.log('coverageStatus:', data.coverageStatus);
      console.log('coverageReason:', data.coverageReason);
      console.log('policyStatus:', data.policyStatus);
      console.log('policyDates:', data.policyDates);
      console.log('policyData:', data.policyData);
      console.groupEnd();
      
      localStorage.removeItem('amg_insurance_data');
      
      const insuranceData = {
        insuranceNumber,
        fullName: data.fullName,
        patientData: data.patientData,
        coverageData: data.coverageData,
        contractData: data.contractData,
        insurancePlanData: data.insurancePlanData,
        coverageStatus: data.coverageStatus,
        policyStatus: data.policyStatus,
        coverageReason: data.coverageReason,
        policyDates: data.policyDates,
        policyData: data.policyData,
        timestamp: Date.now(),
      };
      
      localStorage.setItem('amg_insurance_data', JSON.stringify(insuranceData));

      const policyDesc = data.policyStatus ? `Statut police: ${data.policyStatus}` : 'Statut police: inconnu';
      const dateDesc = data.policyDates?.expiryDate ? `Expire le: ${new Date(data.policyDates.expiryDate).toLocaleDateString()}` : '';
      const reasonDesc = data.coverageReason ? `Raison: ${data.coverageReason}` : '';

      // Notifications supprimées

      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);
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
                placeholder="Entrez votre numéro d'assurance"
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
              {isLoading ? "Vérification en cours..." : "Se connecter"}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              Utilisez votre numéro d'assurance AMG pour accéder à votre espace
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
