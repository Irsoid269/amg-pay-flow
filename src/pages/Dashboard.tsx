import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, History, AlertCircle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
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

        setUserName(insuranceData.fullName || 'Utilisateur');
        setInsuranceNumber(insuranceData.insuranceNumber || '');

        // Utiliser le montant total des factures impayées retourné par l'edge function
        console.log('💵 Total unpaid amount from API:', insuranceData.totalUnpaidAmount);
        
        let amount = '0';
        if (insuranceData.totalUnpaidAmount !== undefined && insuranceData.totalUnpaidAmount > 0) {
          amount = new Intl.NumberFormat('fr-FR').format(insuranceData.totalUnpaidAmount);
          console.log('✅ Montant des factures impayées:', amount, 'KMF');
        } else {
          console.log('ℹ️  Aucune facture impayée');
        }
        
        // === USE STATUS DETERMINED BY EDGE FUNCTION ===
        let finalStatus = 'inactive';
        
        if (insuranceData.coverageStatus) {
          finalStatus = insuranceData.coverageStatus;
          console.log('=== COVERAGE STATUS FROM EDGE FUNCTION ===');
          console.log('✅ Using status determined by AMG API edge function:', finalStatus.toUpperCase());
          
          if (finalStatus === 'active') {
            console.log('   Patient has active insurance coverage');
          } else {
            console.log('   Patient has no active insurance coverage');
          }
        } else {
          console.log('⚠️  Coverage status not provided by edge function, using fallback');
          finalStatus = 'inactive';
        }
        
        console.log('=== RÉSUMÉ POUR CET ASSURÉ ===');
        console.log('👤 Assuré:', insuranceData.insuranceNumber, '-', insuranceData.fullName);
        console.log('📊 Statut:', finalStatus);
        console.log('💰 Montant à payer (factures impayées):', amount, 'KMF');
        console.log('======================================');
        
        setCoverageStatus(finalStatus);
        setPaymentAmount(amount);
        setPaymentType('mensuelle');
        
        setIsLoading(false);
      } catch (error) {
        console.error('Dashboard - Auth check error:', error);
        localStorage.removeItem('amg_insurance_data');
        navigate("/", { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  const handlePayment = () => {
    // Stocker les informations de paiement dans le localStorage
    const paymentData = {
      amount: parseFloat(paymentAmount.replace(/\s/g, '')) || 0,
      currency: 'KMF',
      insuranceNumber: insuranceNumber,
      timestamp: Date.now()
    };
    localStorage.setItem('pendingPayment', JSON.stringify(paymentData));
    navigate("/payment-method");
  };

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
            <img 
              src={logoAmg} 
              alt="AMG Logo" 
              className="h-16 object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
          
          <h1 className="text-3xl font-bold mb-2">Bienvenue</h1>
          <p className="text-primary-foreground/80 text-lg">
            {userName}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 -mt-20 relative z-10">
        <Card className="p-6 shadow-xl mb-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Numéro d'assurance</p>
              <p className="text-xl font-semibold">{insuranceNumber}</p>
            </div>
            
            <div className="flex items-center justify-between py-4 border-t border-b border-border">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Statut</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    coverageStatus === 'active' ? 'bg-success animate-pulse' : 'bg-destructive'
                  }`} />
                  <span className="font-medium">
                    {coverageStatus === 'active' ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Montant à payer</p>
                <p className="text-2xl font-bold text-turquoise">{paymentAmount} KMF</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Type de cotisation</p>
              <p className="font-medium capitalize">{paymentType}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4 mb-6">
          <Button 
            className="w-full py-6 text-lg font-semibold gradient-primary shadow-lg hover:shadow-xl transition-all"
            onClick={handlePayment}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Payer ma cotisation
          </Button>

          <Button 
            variant="outline" 
            className="w-full py-6 text-lg border-2"
            onClick={() => navigate("/history")}
          >
            <History className="mr-2 h-5 w-5" />
            Historique des paiements
          </Button>
        </div>

        <Card className="p-4 bg-turquoise/5 border-turquoise/20">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-turquoise flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm mb-1">Information importante</p>
              <p className="text-sm text-muted-foreground">
                Votre protection est immédiate dès confirmation du paiement de votre cotisation.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
