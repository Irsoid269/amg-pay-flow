import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CreditCard, History, Shield, ArrowRight, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import logoAmg from "@/assets/logo-amg.png";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("Ahmed Mohamed");
  const [isCoverageActive, setIsCoverageActive] = useState(false);
  const insuranceNumber = localStorage.getItem("insuranceNumber") || "AMG-2025-001245";

  useEffect(() => {
    if (!localStorage.getItem("insuranceNumber")) {
      navigate("/");
    }
    
    // Check if coverage is active from localStorage
    const payments = localStorage.getItem("payments");
    if (payments) {
      const parsedPayments = JSON.parse(payments);
      const hasSuccessfulPayment = parsedPayments.some((p: any) => p.status === "success");
      setIsCoverageActive(hasSuccessfulPayment);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("insuranceNumber");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-turquoise/5 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 right-20 w-96 h-96 bg-turquoise/5 rounded-full blur-3xl animate-pulse-soft" />
      <div className="absolute bottom-20 left-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      
      {/* Header */}
      <header className="gradient-hero text-primary-foreground relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/10" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 animate-fade-in-left">
              <img src={logoAmg} alt="AMG Logo" className="h-12 w-auto" />
              <div>
                <h1 className="text-2xl font-bold">AMG Comores</h1>
                <p className="text-sm text-primary-foreground/80">Assurance Maladie Généralisée</p>
              </div>
            </div>
            <div className="flex items-center gap-3 animate-fade-in-right">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/notifications")}
                className="relative text-primary-foreground hover:bg-primary-foreground/10 rounded-full"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-turquoise rounded-full animate-pulse" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-primary-foreground hover:bg-primary-foreground/10 rounded-full"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 pb-12">
        {/* Welcome Card */}
        <Card className="mb-8 border-2 border-turquoise/20 shadow-turquoise hover-lift animate-scale-in glass-effect">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">
                  Bonjour, <span className="text-turquoise">{name}</span> 👋
                </CardTitle>
                <CardDescription className="text-base">
                  Numéro d'assurance : <span className="font-mono font-semibold text-foreground">{insuranceNumber}</span>
                </CardDescription>
              </div>
              <Shield className="w-12 h-12 text-turquoise animate-bounce-soft" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Status Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-turquoise/5 to-turquoise/10 border-2 border-turquoise/20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-3 mb-3">
                  {isCoverageActive ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-success" />
                      <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20">
                        Actif
                      </Badge>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-6 h-6 text-warning" />
                      <Badge className="bg-warning/10 text-warning hover:bg-warning/20 border-warning/20">
                        En attente
                      </Badge>
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Statut de couverture</p>
                <p className="text-lg font-bold text-foreground">
                  {isCoverageActive ? "Couverture active" : "En attente de paiement"}
                </p>
              </div>

              {/* Amount Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <p className="text-sm font-medium text-muted-foreground mb-2">Montant à payer</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-primary to-turquoise bg-clip-text text-transparent">
                  3 000 KMF
                </p>
                <p className="text-xs text-muted-foreground mt-1">Cotisation mensuelle</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Pay Card */}
          <Card 
            className="group cursor-pointer hover-lift border-2 border-transparent hover:border-turquoise/30 transition-all duration-300 animate-fade-in overflow-hidden"
            style={{ animationDelay: '0.3s' }}
            onClick={() => navigate("/payment-method")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-turquoise/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="relative">
              <div className="w-14 h-14 rounded-2xl gradient-turquoise flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <CreditCard className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">Payer ma cotisation</CardTitle>
              <CardDescription>
                Effectuez votre paiement via HOLO
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <Button className="w-full gradient-turquoise hover:shadow-turquoise transition-all duration-300 group-hover:translate-x-1">
                Payer maintenant
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* History Card */}
          <Card 
            className="group cursor-pointer hover-lift border-2 border-transparent hover:border-primary/30 transition-all duration-300 animate-fade-in"
            style={{ animationDelay: '0.4s' }}
            onClick={() => navigate("/history")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="relative">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <History className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">Historique</CardTitle>
              <CardDescription>
                Consultez vos transactions passées
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <Button variant="outline" className="w-full group-hover:bg-primary/5 group-hover:border-primary/50 transition-all">
                Voir l'historique
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card 
            className="group cursor-pointer hover-lift border-2 border-transparent hover:border-accent/30 transition-all duration-300 animate-fade-in md:col-span-2 lg:col-span-1"
            style={{ animationDelay: '0.5s' }}
            onClick={() => navigate("/notifications")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-foreground/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">Notifications</CardTitle>
              <CardDescription>
                Messages de vos opérateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <Button variant="outline" className="w-full group-hover:bg-accent/5 group-hover:border-accent/50 transition-all">
                Voir les messages
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="mt-8 border-2 border-turquoise/20 bg-gradient-to-r from-turquoise/5 to-transparent animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-turquoise/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-turquoise" />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2 text-foreground">Votre santé, notre priorité</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Avec l'AMG, bénéficiez d'une couverture santé complète pour vous et votre famille. 
                  Paiements sécurisés et activation instantanée de vos droits.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;