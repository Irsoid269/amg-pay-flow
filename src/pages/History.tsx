import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Payment {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  date: string;
  paymentIdentifier: string;
  description: string;
}

const History = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [insuranceNumber, setInsuranceNumber] = useState("");

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        // Get insurance number from localStorage
        const storedData = localStorage.getItem('amg_insurance_data');
        
        if (!storedData) {
          console.log('No insurance data, redirecting to login');
          navigate("/", { replace: true });
          return;
        }

        const insuranceData = JSON.parse(storedData);
        const patientInsuranceNumber = insuranceData.insuranceNumber;
        setInsuranceNumber(patientInsuranceNumber);

        console.log('Fetching payment history for:', patientInsuranceNumber);

        // Call the edge function to get payments from AMG API
        const { data, error } = await supabase.functions.invoke('amg-get-payments', {
          body: { insuranceNumber: patientInsuranceNumber }
        });

        if (error) {
          console.error('Error fetching payments:', error);
          toast({
            title: "Erreur",
            description: "Impossible de charger l'historique des paiements",
            variant: "destructive",
          });
          setPayments([]);
        } else if (data) {
          console.log('Payments received:', data);
          setPayments(data.payments || []);
          
          if (!data.payments || data.payments.length === 0) {
            toast({
              title: "Information",
              description: "Aucun paiement trouvé dans le système AMG",
            });
          }
        }
      } catch (error) {
        console.error('Error in fetchPayments:', error);
        toast({
          title: "Erreur",
          description: "Une erreur est survenue lors du chargement",
          variant: "destructive",
        });
        setPayments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [navigate]);

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('active') || normalizedStatus.includes('complete') || normalizedStatus.includes('paid')) {
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    } else if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('error') || normalizedStatus.includes('entered-in-error')) {
      return <XCircle className="w-5 h-5 text-destructive" />;
    } else {
      return <Clock className="w-5 h-5 text-pending" />;
    }
  };

  const getStatusText = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('active') || normalizedStatus.includes('complete') || normalizedStatus.includes('paid')) {
      return "Payé";
    } else if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('error') || normalizedStatus.includes('entered-in-error')) {
      return "Annulé";
    } else if (normalizedStatus.includes('draft')) {
      return "Brouillon";
    } else {
      return status;
    }
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes('active') || normalizedStatus.includes('complete') || normalizedStatus.includes('paid')) {
      return "text-success";
    } else if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('error') || normalizedStatus.includes('entered-in-error')) {
      return "text-destructive";
    } else {
      return "text-pending";
    }
  };

  const formatDate = (dateString: string) => {
    if (dateString === 'N/A') return dateString;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency}`;
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
                      <span className="font-semibold">{payment.description}</span>
                      <span className="font-bold text-turquoise">
                        {formatAmount(payment.amount, payment.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{formatDate(payment.date)}</span>
                      <span className={getStatusColor(payment.status)}>
                        {getStatusText(payment.status)}
                      </span>
                    </div>
                    {payment.paymentIdentifier !== 'N/A' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {payment.paymentIdentifier}
                      </div>
                    )}
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
