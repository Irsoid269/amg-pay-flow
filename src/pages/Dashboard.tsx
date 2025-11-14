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
        console.log('=== DONNÉES ASSURÉ ===');
        console.log('Numéro assurance:', insuranceData.insuranceNumber);
        console.log('Nom complet:', insuranceData.fullName);
        console.log('Coverage data structure:', JSON.stringify(insuranceData.coverageData, null, 2));
        console.log('Contract data structure:', JSON.stringify(insuranceData.contractData, null, 2));
        console.log('Insurance plan data structure:', JSON.stringify(insuranceData.insurancePlanData, null, 2));

        setUserName(insuranceData.fullName || 'Utilisateur');
        setInsuranceNumber(insuranceData.insuranceNumber || '');

        // Extraire le montant depuis Contract, InsurancePlan ou utiliser la valeur par défaut
        let amount = '3 000';
        let paymentFrequency = 'mensuelle';
        
        // Fonction récursive pour chercher tous les montants dans un objet
        const findAllAmounts = (obj: any, path = '', results: any[] = []): any[] => {
          if (obj === null || obj === undefined) return results;
          
          if (typeof obj === 'object') {
            // Chercher les champs de type Money ou montants
            if (obj.value !== undefined && typeof obj.value === 'number') {
              results.push({ path, value: obj.value, currency: obj.currency });
            }
            if (obj.valueMoney !== undefined) {
              results.push({ path: path + '.valueMoney', ...obj.valueMoney });
            }
            
            // Parcourir récursivement
            Object.keys(obj).forEach(key => {
              const newPath = path ? `${path}.${key}` : key;
              findAllAmounts(obj[key], newPath, results);
            });
          }
          
          return results;
        };
        
        console.log('=== SEARCHING FOR ALL AMOUNTS IN ALL FHIR RESOURCES ===');
        
        // Stratégie 1: Explorer complètement le Contract et chercher PolicyStatus
        if (insuranceData.contractData?.entry?.[0]?.resource) {
          const contract = insuranceData.contractData.entry[0].resource;
          console.log('📋 CONTRACT - Searching all amounts and PolicyStatus...');
          
          // Chercher PolicyStatus dans les extensions
          const findPolicyStatus = (obj: any, path = ''): any => {
            if (obj === null || obj === undefined) return null;
            
            if (typeof obj === 'object') {
              // Chercher des extensions avec PolicyStatus
              if (obj.url && obj.url.includes('policy-status')) {
                console.log('Found policy-status extension:', obj);
                return obj;
              }
              if (obj.extension && Array.isArray(obj.extension)) {
                for (const ext of obj.extension) {
                  const found = findPolicyStatus(ext, path + '.extension');
                  if (found) return found;
                }
              }
              // Chercher récursivement
              for (const key in obj) {
                const found = findPolicyStatus(obj[key], path ? `${path}.${key}` : key);
                if (found) return found;
              }
            }
            return null;
          };
          
          const policyStatusExt = findPolicyStatus(contract);
          if (policyStatusExt) {
            console.log('PolicyStatus extension found:', policyStatusExt);
          }
          
          const contractAmounts = findAllAmounts(contract, 'contract');
          console.log('All amounts found in Contract:', contractAmounts);
          
          // MONTANT DE LA COTISATION (contract-premium.amount)
          // C'est le montant que l'assuré doit payer
          if (contract.term?.[0]?.asset?.[0]?.extension) {
            const premiumExtension = contract.term[0].asset[0].extension.find(
              (ext: any) => ext.url === 'https://openimis.github.io/openimis_fhir_r4_ig/StructureDefinition/contract-premium'
            );
            
            if (premiumExtension?.extension) {
              console.log('Premium extension found:', JSON.stringify(premiumExtension, null, 2));
              
              const amountExt = premiumExtension.extension.find((ext: any) => ext.url === 'amount');
              if (amountExt?.valueMoney?.value) {
                amount = new Intl.NumberFormat('fr-FR').format(amountExt.valueMoney.value);
                console.log('💰 MONTANT COTISATION (contract.premium.amount):', amount, 'KMF');
              }
            }
          }
          
          // VALEUR DE LA POLICE (PolicyValue)
          // C'est la couverture maximum, PAS le montant à payer
          if (contract.term?.[0]?.asset?.[0]?.valuedItem?.[0]?.net?.value) {
            const policyValue = contract.term[0].asset[0].valuedItem[0].net.value;
            console.log('📋 POLICY VALUE (couverture max, tblPolicy.PolicyValue):', new Intl.NumberFormat('fr-FR').format(policyValue), 'KMF');
            console.log('   Note: PolicyValue est la couverture, pas le montant à payer');
          }
        }
        
        // Stratégie 2: Explorer complètement le Coverage
        if (insuranceData.coverageData?.entry) {
          console.log('📄 COVERAGE - Searching all amounts...');
          
          insuranceData.coverageData.entry.forEach((entry: any, index: number) => {
            const coverage = entry.resource;
            const coverageAmounts = findAllAmounts(coverage, `coverage[${index}]`);
            if (coverageAmounts.length > 0) {
              console.log(`Coverage[${index}] amounts:`, coverageAmounts);
            }
          });
        }
        
        // Stratégie 3: Explorer complètement l'InsurancePlan
        if (insuranceData.insurancePlanData?.entry) {
          console.log('📦 INSURANCE PLAN - Searching all amounts...');
          
          insuranceData.insurancePlanData.entry.forEach((entry: any, index: number) => {
            const plan = entry.resource;
            console.log(`Insurance Plan[${index}] name:`, plan.name);
            
            const planAmounts = findAllAmounts(plan, `plan[${index}]`);
            if (planAmounts.length > 0) {
              console.log(`Insurance Plan[${index}] amounts:`, planAmounts);
            }
            
            // Spécifiquement chercher dans les coûts
            if (plan.plan?.[0]) {
              console.log(`Plan[${index}] generalCost:`, plan.plan[0].generalCost);
              console.log(`Plan[${index}] specificCost:`, plan.plan[0].specificCost);
            }
          });
        }
        
        console.log('=== END OF AMOUNT SEARCH ===');
        console.log('💰 Montant final à afficher:', amount, 'KMF');
        console.log('📅 Type de paiement:', paymentFrequency);

        // Ne PAS écraser le montant ici, on utilise celui trouvé dans contract.premium
        
        // === MAPPING OFFICIEL openIMIS FHIR ===
        // tblPolicy → Contract (ressource FHIR)
        // tblPolicy.PolicyStatus (NUMERIC) → Contract.status (TEXT)
        //   PolicyStatus codes openIMIS:
        //   1 = Idle (en attente)
        //   2 = Active (actif)
        //   4 = Suspended (suspendu)
        //   8 = Expired (expiré)
        //   16 = Ready (prêt)
        // 
        // Contract.status mapping:
        //   "offered" = police proposée/active (PolicyStatus=2)
        //   "policy" = police active (PolicyStatus=2)
        //   "executed" = police exécutée (PolicyStatus=2)
        //   "cancelled" = police annulée
        //   "terminated" = police terminée
        console.log('=== DETERMINING POLICY STATUS (tblPolicy.PolicyStatus) ===');
        
        let finalStatus = 'inactive';
        
        if (insuranceData.contractData?.entry?.[0]?.resource) {
          const contract = insuranceData.contractData.entry[0].resource;
          console.log('📋 Contract.status (maps to tblPolicy.PolicyStatus):', contract.status);
          
          // Vérifier période de validité (tblPolicy.EffectiveDate / ExpiryDate)
          let periodValid = false;
          let periodStart = null;
          let periodEnd = null;
          
          if (contract.term?.[0]?.asset?.[0]?.period?.[0]) {
            periodStart = contract.term[0].asset[0].period[0].start;
            periodEnd = contract.term[0].asset[0].period[0].end;
            const startDate = new Date(periodStart);
            const endDate = new Date(periodEnd);
            const now = new Date();
            periodValid = now >= startDate && now <= endDate;
            console.log('📅 EffectiveDate:', periodStart);
            console.log('📅 ExpiryDate:', periodEnd);
            console.log('📅 Period valid:', periodValid);
          }
          
          // LOGIQUE OFFICIELLE openIMIS pour déterminer le statut de l'assuré:
          // 1. Contract.status doit indiquer une police active
          // 2. La période doit être valide (entre EffectiveDate et ExpiryDate)
          // 3. Contract.status "offered" ou "policy" ou "executed" = PolicyStatus=2 (Active)
          
          const statusLower = contract.status?.toLowerCase() || '';
          
          // Déterminer si la police est dans un état actif selon le système AMG
          const isActiveStatus = (
            statusLower === 'offered' || 
            statusLower === 'policy' || 
            statusLower === 'executed'
          );
          
          if (isActiveStatus && periodValid) {
            finalStatus = 'active';
            console.log('✅ POLICY STATUS: ACTIVE (tblPolicy.PolicyStatus=2)');
            console.log(`   Contract.status="${contract.status}" (active state in AMG system)`);
            console.log(`   Period valid: ${periodStart} to ${periodEnd}`);
          } else {
            finalStatus = 'inactive';
            console.log('❌ POLICY STATUS: INACTIVE');
            if (!isActiveStatus) {
              console.log(`   Reason: Contract.status="${contract.status}" indicates inactive state in AMG system`);
              console.log(`   (not offered/policy/executed = PolicyStatus is not 2)`);
            }
            if (!periodValid) {
              console.log('   Reason: Period expired or not yet started');
              if (periodStart && periodEnd) {
                const now = new Date();
                const start = new Date(periodStart);
                const end = new Date(periodEnd);
                if (now < start) {
                  console.log(`   Policy not yet effective (starts ${periodStart})`);
                } else if (now > end) {
                  console.log(`   Policy expired (ended ${periodEnd})`);
                }
              }
            }
          }
        }
        
        console.log('=== FINAL STATUS ===');
        console.log('Coverage Status:', finalStatus);
        console.log('=== FINAL AMOUNT ===');
        console.log('💰 Montant cotisation pour cet assuré:', amount, 'KMF');
        
        setCoverageStatus(finalStatus);
        setPaymentAmount(amount);
        setPaymentType(paymentFrequency);
        
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
