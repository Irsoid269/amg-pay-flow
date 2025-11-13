import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface Payment {
  id: number;
  operator: string;
  amount: string;
  date: string;
  status: "success" | "failed" | "pending";
}

const History = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    // Load payments from localStorage or use demo data
    const storedPayments = localStorage.getItem("payments");
    if (storedPayments) {
      setPayments(JSON.parse(storedPayments));
    } else {
      // Demo data
      setPayments([
        {
          id: 3,
          operator: "HOLO",
          amount: "3 000 KMF",
          date: "11/11/2025",
          status: "success",
        },
        {
          id: 2,
          operator: "HURI",
          amount: "3 000 KMF",
          date: "10/10/2025",
          status: "failed",
        },
        {
          id: 1,
          operator: "MVOLA",
          amount: "3 000 KMF",
          date: "08/09/2025",
          status: "pending",
        },
      ]);
    }
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-destructive" />;
      case "pending":
        return <Clock className="w-5 h-5 text-pending" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return "Réussi";
      case "failed":
        return "Échoué";
      case "pending":
        return "En attente";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "text-success";
      case "failed":
        return "text-destructive";
      case "pending":
        return "text-pending";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-turquoise/5 rounded-full blur-3xl animate-pulse-soft" />
      
      <div className="gradient-primary text-primary-foreground p-6 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/10" />
        <div className="max-w-4xl mx-auto relative z-10 animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10 mb-6 -ml-2 rounded-full transition-all hover:scale-105"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 animate-fade-in-left">
            Historique des paiements
          </h1>
          <p className="text-primary-foreground/80 text-sm md:text-base animate-fade-in-left" style={{ animationDelay: '0.1s' }}>
            Consultez toutes vos transactions AMG
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 pb-12 relative z-10">
        {payments.length === 0 ? (
          <Card className="p-12 text-center glass-effect border-2 border-border/50 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Clock className="w-10 h-10 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-muted-foreground">Aucun paiement enregistré</p>
            <p className="text-sm text-muted-foreground mt-2">Vos transactions apparaîtront ici</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment, index) => (
              <Card
                key={payment.id}
                className="group p-6 hover:shadow-turquoise transition-all duration-300 animate-fade-in hover-lift border-2 border-border hover:border-turquoise/30 rounded-2xl overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-turquoise/0 to-turquoise/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative flex items-center gap-5">
                  {/* Status Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    payment.status === 'success' ? 'bg-success/10' :
                    payment.status === 'failed' ? 'bg-destructive/10' :
                    'bg-pending/10'
                  }`}>
                    {getStatusIcon(payment.status)}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-bold text-lg text-foreground">{payment.operator}</span>
                        <span className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${
                          payment.status === 'success' ? 'bg-success/10 text-success border border-success/20' :
                          payment.status === 'failed' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                          'bg-pending/10 text-pending border border-pending/20'
                        }`}>
                          {getStatusText(payment.status)}
                        </span>
                      </div>
                      <span className="font-bold text-xl text-primary">{payment.amount}</span>
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{payment.date}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Info Banner */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-turquoise/5 to-transparent border-2 border-turquoise/20 rounded-2xl animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-turquoise/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les paiements sont traités en temps réel par votre opérateur mobile. 
              En cas de problème, contactez le service client de votre opérateur.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default History;
