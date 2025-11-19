import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, AlertCircle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import logoAmg from "@/assets/logo-amg.png";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Utilisateur");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [coverageStatus, setCoverageStatus] = useState("inactive");
  const [coverageReason, setCoverageReason] = useState<string | null>(null);
  const [policyStatus, setPolicyStatus] = useState<string | null>(null);
  const [policyExpiry, setPolicyExpiry] = useState<string | null>(null);
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

        // Info sur factures impayées côté API (pour logs)
        console.log('💵 Total unpaid amount from API:', insuranceData.totalUnpaidAmount);
        
        // === USE STATUS DETERMINED BY EDGE FUNCTION ===
        let finalStatus = 'inactive';
        
        if (insuranceData.coverageStatus) {
          finalStatus = insuranceData.coverageStatus;
          console.log('=== COVERAGE STATUS FROM EDGE FUNCTION ===');
          console.log('✅ Using status determined by AMG API edge function:', finalStatus.toUpperCase());
          
          if (finalStatus === 'active') {
            console.log('   Patient has active insurance coverage');
          } else {
  const msgByStatus = {
    active: '   Patient has active insurance coverage',
    pending: '   Couverture en attente (statut brouillon/pending)',
    inactive: '   Patient has no active insurance coverage',
    unknown: '   Statut de couverture inconnu',
  } as const;
  console.log(msgByStatus[finalStatus as keyof typeof msgByStatus] || msgByStatus.unknown);
          }
        } else {
          console.log('⚠️  Coverage status not provided by edge function, using fallback');
          finalStatus = 'inactive';
        }
        
        // Déterminer le montant à payer à afficher
        let amount = '0';
        const policyValue = insuranceData.policyData?.policyValue;
        if (finalStatus === 'inactive' && typeof policyValue === 'number' && policyValue > 0) {
          amount = new Intl.NumberFormat('fr-FR').format(policyValue);
          console.log('✅ Montant à payer (pour activer la police):', amount, 'KMF');
        } else if (insuranceData.totalUnpaidAmount !== undefined && insuranceData.totalUnpaidAmount > 0) {
          amount = new Intl.NumberFormat('fr-FR').format(insuranceData.totalUnpaidAmount);
          console.log('✅ Montant des factures impayées:', amount, 'KMF');
        } else {
          console.log('ℹ️  Aucune facture impayée');
        }

        console.log('=== RÉSUMÉ POUR CET ASSURÉ ===');
        console.log('👤 Assuré:', insuranceData.insuranceNumber, '-', insuranceData.fullName);
        console.log('📊 Statut:', finalStatus);
        console.log('💰 Montant à payer:', amount, 'KMF');
        console.log('======================================');
        
        setCoverageStatus(finalStatus);
        setCoverageReason(insuranceData.coverageReason || null);
        setPolicyStatus(insuranceData.policyStatus || null);
        setPolicyExpiry(insuranceData.policyDates?.expiryDate || null);
        setPaymentAmount(amount);
        setPaymentType('mensuelle');
        
        setIsLoading(false);

        // Fetch real-time policy status directly from GraphQL via Edge Function
        (async () => {
          try {
            const useLocalFns = (import.meta as any).env?.VITE_USE_LOCAL_FUNCTIONS === 'true';
            const localFnsUrl = (import.meta as any).env?.VITE_LOCAL_FUNCTIONS_URL || 'http://localhost:54321/functions/v1';

            let gqlData: any = null;
            let error: any = null;

            if (useLocalFns) {
              const resp = await fetch(`${localFnsUrl}/amg-get-policy-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insuranceNumber: insuranceData.insuranceNumber }),
              });
              if (!resp.ok) {
                error = await resp.text();
              } else {
                gqlData = await resp.json();
              }
            } else {
              const { data: cloudData, error: cloudErr } = await supabase.functions.invoke('amg-get-policy-status', {
                body: { insuranceNumber: insuranceData.insuranceNumber },
              });
              gqlData = cloudData; error = cloudErr;
            }

            if (error) {
              console.warn('GraphQL policy status fetch error:', error);
              return;
            }

            if (gqlData && gqlData.exists) {
              const policyStatus = gqlData.policyStatus || null;
              const expiry = gqlData.policyDates?.expiryDate || null;
              const coverageStatusFromGraphQL = gqlData.coverageStatusGraphQL || null;
              const coverageReasonFromGraphQL = gqlData.coverageReasonGraphQL || null;

  console.group('Statut police (live via GraphQL/FHIR)');
              console.log('policyStatus:', policyStatus);
              console.log('expiryDate:', expiry);
              console.log('coverageStatusGraphQL:', coverageStatusFromGraphQL);
              console.log('coverageReasonGraphQL:', coverageReasonFromGraphQL);
              console.groupEnd();

              if (coverageStatusFromGraphQL) {
                setCoverageStatus(coverageStatusFromGraphQL);
              }
              setCoverageReason(coverageReasonFromGraphQL);
              setPolicyStatus(policyStatus);
              setPolicyExpiry(expiry);
            }
          } catch (e) {
            console.warn('GraphQL status fetch exception:', e);
          }
        })();
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
                    coverageStatus === 'active'
                      ? 'bg-success animate-pulse'
                      : coverageStatus === 'pending'
                        ? 'bg-yellow-500'
                        : 'bg-destructive'
                  }`} />
                  <span className="font-medium">
                    {coverageStatus === 'active' ? 'Actif' : coverageStatus === 'pending' ? 'En attente' : 'Inactif'}
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

            <div className="mt-4 space-y-1">
              {policyExpiry && (
                <p className="text-sm text-muted-foreground">
                  Expire le: {new Date(policyExpiry).toLocaleDateString()}
                </p>
              )}
              {(['graphql_active_in_window','graphql_inactive_status','graphql_pending_status','fallback_active_contract','fallback_no_contract'] as const).includes(coverageReason as any) && (
                <p className="text-sm text-muted-foreground">
                  Raison: {
                    coverageReason === 'graphql_active_in_window' ? 'Police ACTIVE et dates valides' :
                    coverageReason === 'graphql_inactive_status' ? 'Police inactive (EXPIRED/SUSPENDED/CANCELLED)' :
                    coverageReason === 'graphql_pending_status' ? 'Police en attente de validation' :
                    coverageReason === 'fallback_active_contract' ? 'Contrat actif en base (fallback)' :
                    'Aucun contrat actif (fallback)'
                  }
                </p>
              )}
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

          {/* Bouton Historique des paiements retiré */}
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
