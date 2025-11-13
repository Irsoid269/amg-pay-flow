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
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-md mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-primary-foreground hover:bg-primary-foreground/10 mb-4 -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold">Historique des paiements</h1>
          <p className="text-primary-foreground/80 mt-2">
            Consultez vos transactions AMG
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        {payments.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Aucun paiement enregistré</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <Card
                key={payment.id}
                className="p-4 hover:shadow-md transition-shadow animate-fade-in"
              >
                <div className="flex items-center gap-4">
                  <div>{getStatusIcon(payment.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{payment.operator}</span>
                      <span className="font-bold">{payment.amount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{payment.date}</span>
                      <span className={getStatusColor(payment.status)}>
                        {getStatusText(payment.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-6 p-4 bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            💡 Les paiements sont traités en temps réel par votre opérateur mobile
          </p>
        </Card>
      </div>
    </div>
  );
};

export default History;
