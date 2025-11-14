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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Dashboard - Checking authentication...');
        
        // Utiliser getSession au lieu de getUser pour vérifier la session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('Dashboard - No session found, redirecting to login');
          navigate("/", { replace: true });
          return;
        }

        console.log('Dashboard - Session found for user:', session.user.id);

        // Get profile data
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error('Dashboard - Error fetching profile:', error);
          toast({
            title: "Erreur",
            description: "Impossible de charger vos informations",
            variant: "destructive",
          });
        } else if (profile) {
          console.log('Dashboard - Profile loaded successfully');
          setUserName(profile.full_name || "Utilisateur");
          setInsuranceNumber(profile.insurance_number);
        } else {
          console.log('Dashboard - No profile found for user');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Dashboard - Auth check error:', error);
        setIsLoading(false);
        navigate("/", { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    console.log('Logging out...');
    await supabase.auth.signOut();
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
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 text-warning text-sm font-semibold border border-warning/20">
                <AlertCircle className="w-4 h-4" />
                Inactif
              </div>
            </div>

            <div className="pt-4 border-t border-turquoise/20">
              <p className="text-sm text-muted-foreground mb-2 font-medium">Montant à payer</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-primary to-turquoise bg-clip-text text-transparent">3 000 KMF</p>
              <p className="text-sm text-muted-foreground mt-2">Cotisation mensuelle</p>
            </div>

            <div className="pt-3 flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Couverture inactive</p>
                <p className="text-xs text-destructive/80 mt-0.5">En attente de paiement</p>
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
