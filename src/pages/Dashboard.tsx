import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, History, AlertCircle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logoAmg from "@/assets/logo-amg.png";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Utilisateur");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [coverageStatus, setCoverageStatus] = useState("inactive");
  const [paymentType, setPaymentType] = useState("mensuelle");

  useEffect(() => {
    const checkAuth = () => {
      try {
        console.log('Dashboard - Checking authentication...');
        
        // Vérifier si les données d'assurance sont dans le localStorage
        const storedData = localStorage.getItem('amg_insurance_data');
        
        if (!storedData) {
          console.log('Dashboard - No insurance data, redirecting to login');
          navigate("/", { replace: true });
          return;
        }

        const insuranceData = JSON.parse(storedData);
        
        // Vérifier que les données ne sont pas trop anciennes (24h)
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures
        if (Date.now() - insuranceData.timestamp > maxAge) {
          console.log('Dashboard - Data expired, redirecting to login');
          localStorage.removeItem('amg_insurance_data');
          navigate("/", { replace: true });
          return;
        }

        console.log('Dashboard - Data loaded:', insuranceData);
        console.log('Coverage data structure:', JSON.stringify(insuranceData.coverageData, null, 2));
        console.log('Contract data structure:', JSON.stringify(insuranceData.contractData, null, 2));
        console.log('Insurance plan data structure:', JSON.stringify(insuranceData.insurancePlanData, null, 2));

        setUserName(insuranceData.fullName || 'Utilisateur');
        setInsuranceNumber(insuranceData.insuranceNumber || '');

        // Extraire le montant depuis Contract, InsurancePlan ou utiliser la valeur par défaut
        let amount = '3 000';
        let paymentFrequency = 'mensuelle';
        
        // Stratégie 1: Essayer de récupérer depuis le Contract (FHIR Contract resource)
        if (insuranceData.contractData?.entry?.[0]?.resource) {
          const contract = insuranceData.contractData.entry[0].resource;
          console.log('Contract resource found:', contract);
          
          // Essayer term[0].asset[0].extension pour trouver l'amount
          if (contract.term?.[0]?.asset?.[0]?.extension) {
            const premiumExtension = contract.term[0].asset[0].extension.find(
              (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/contract-premium'
            );
            if (premiumExtension?.extension) {
              const amountExt = premiumExtension.extension.find((ext: any) => ext.url === 'amount');
              if (amountExt?.valueMoney?.value) {
                amount = new Intl.NumberFormat('fr-FR').format(amountExt.valueMoney.value);
                console.log('Amount from contract.term.asset.extension (premium):', amount);
              }
            }
          }
          // Essayer term[0].asset[0].valuedItem[0].net
          if (amount === '3 000' && contract.term?.[0]?.asset?.[0]?.valuedItem?.[0]?.net?.value) {
            amount = new Intl.NumberFormat('fr-FR').format(contract.term[0].asset[0].valuedItem[0].net.value);
            console.log('Amount from contract.term.asset.valuedItem.net:', amount);
          }
        }
        
        // Stratégie 2: Essayer de récupérer depuis l'InsurancePlan (FHIR InsurancePlan resource)
        if (amount === '3 000' && insuranceData.insurancePlanData?.entry?.[0]?.resource) {
          const plan = insuranceData.insurancePlanData.entry[0].resource;
          console.log('InsurancePlan resource found:', plan);
          
          // Essayer plan[0].specificCost[0].benefit[0].cost[0]
          if (plan.plan?.[0]?.specificCost?.[0]?.benefit?.[0]?.cost?.[0]?.value?.value) {
            amount = new Intl.NumberFormat('fr-FR').format(plan.plan[0].specificCost[0].benefit[0].cost[0].value.value);
            console.log('Amount from plan.specificCost:', amount);
          }
          // Essayer generalCost
          else if (plan.plan?.[0]?.generalCost?.[0]?.cost?.value) {
            amount = new Intl.NumberFormat('fr-FR').format(plan.plan[0].generalCost[0].cost.value);
            console.log('Amount from plan.generalCost:', amount);
          }
        }

        setPaymentAmount(amount);
        setPaymentType(paymentFrequency);
        
        console.log('Final payment amount:', amount, 'KMF');
        
        // Extraire les informations de couverture depuis coverageData
        if (insuranceData.coverageData && insuranceData.coverageData.entry) {
          const entries = insuranceData.coverageData.entry;
          
          console.log('Total coverage entries:', entries.length);
          
          if (entries.length > 0) {
            const latestCoverage = entries[0].resource;
            console.log('Latest coverage:', latestCoverage);
            
            // Statut de la couverture (active, draft, suspended, cancelled, entered-in-error)
            const apiStatus = latestCoverage.status || 'draft';
            console.log('Coverage status from API:', apiStatus);
            
            // Vérifier les dates de validité
            let coverageValid = false;
            if (latestCoverage.period) {
              const startDate = new Date(latestCoverage.period.start);
              const endDate = new Date(latestCoverage.period.end);
              const now = new Date();
              coverageValid = now >= startDate && now <= endDate;
              
              console.log('Coverage period:', {
                start: startDate,
                end: endDate,
                valid: coverageValid,
                currentDate: now
              });
            }
            
            // Déterminer si la couverture est active
            // Draft = en attente de paiement
            // Active + dates valides = couvert
            // Active mais dates invalides = expiré
            let finalStatus = 'inactive';
            let isCovered = false;
            
            if (apiStatus === 'active' && coverageValid) {
              finalStatus = 'active';
              isCovered = true;
            } else if (apiStatus === 'draft') {
              finalStatus = 'pending'; // En attente de paiement
              isCovered = false;
            } else if (apiStatus === 'active' && !coverageValid) {
              finalStatus = 'expired';
              isCovered = false;
            } else if (apiStatus === 'cancelled' || apiStatus === 'suspended') {
              finalStatus = 'cancelled';
              isCovered = false;
            }
            
            console.log('Final coverage status:', finalStatus);
            console.log('Is covered:', isCovered);
            
            setCoverageStatus(finalStatus);
          }
        } else {
          console.log('No coverage data available');
          setCoverageStatus('inactive');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Dashboard - Auth check error:', error);
        localStorage.removeItem('amg_insurance_data');
        navigate("/", { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = () => {
    console.log('Logging out...');
    localStorage.removeItem('amg_insurance_data');
    navigate("/", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-turquoise/5 rounded-full blur-3xl arc-shape" />
      
      <div className="gradient-primary text-primary-foreground p-6 pb-28 relative">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <img src={logoAmg} alt="Logo AMG" className="h-14 w-auto drop-shadow-lg" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-turquoise/20 rounded-full"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-2">Bonjour, {userName} 👋</h1>
          <p className="text-primary-foreground/90 text-sm">Bienvenue sur votre espace AMG</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-20 pb-8 space-y-4 relative z-10">
        <Card className="p-6 shadow-turquoise animate-scale-in gradient-card border-2 border-turquoise/20 rounded-2xl">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">Numéro d'assurance</p>
                <p className="text-lg font-bold text-primary">{insuranceNumber}</p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                coverageStatus === 'active' 
                  ? 'bg-success/10 text-success border-success/20' 
                  : 'bg-warning/10 text-warning border-warning/20'
              }`}>
                <AlertCircle className="w-4 h-4" />
                {coverageStatus === 'active' ? 'Actif' : 'Inactif'}
              </div>
            </div>

            <div className="pt-4 border-t border-turquoise/20">
              <p className="text-sm text-muted-foreground mb-2 font-medium">Montant à payer</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-primary to-turquoise bg-clip-text text-transparent">{paymentAmount} KMF</p>
              <p className="text-sm text-muted-foreground mt-2">Cotisation {paymentType}</p>
            </div>

            <div className={`pt-3 flex items-start gap-3 p-3 border rounded-xl ${
              coverageStatus === 'active'
                ? 'bg-success/5 border-success/20'
                : 'bg-destructive/5 border-destructive/20'
            }`}>
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                coverageStatus === 'active' ? 'text-success' : 'text-destructive'
              }`} />
              <div>
                <p className={`text-sm font-semibold ${
                  coverageStatus === 'active' ? 'text-success' : 'text-destructive'
                }`}>
                  {coverageStatus === 'active' ? 'Couverture active' : 'Couverture inactive'}
                </p>
                <p className={`text-xs mt-0.5 ${
                  coverageStatus === 'active' ? 'text-success/80' : 'text-destructive/80'
                }`}>
                  {coverageStatus === 'active' ? 'Votre couverture est à jour' : 'En attente de paiement'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Button
            onClick={() => navigate("/payment-method")}
            className="w-full h-16 text-base font-bold gradient-turquoise hover:shadow-turquoise transition-all duration-300 rounded-2xl"
            size="lg"
          >
            <CreditCard className="mr-3 h-6 w-6" />
            Payer ma cotisation
          </Button>

          <Button
            onClick={() => navigate("/history")}
            variant="outline"
            className="w-full h-16 text-base font-bold border-2 border-turquoise/30 hover:bg-turquoise/5 hover:border-turquoise rounded-2xl"
            size="lg"
          >
            <History className="mr-3 h-6 w-6" />
            Historique des paiements
          </Button>
        </div>

        <Card className="p-5 bg-turquoise/5 border-2 border-turquoise/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-turquoise/20 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">ℹ️</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Protection immédiate
              </p>
              <p className="text-sm text-muted-foreground">
                Vos droits AMG seront activés immédiatement après confirmation du paiement.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
