import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface Notification {
  id: number;
  operator: string;
  message: string;
  time: string;
  type: "info" | "success" | "error";
}

const notifications: Notification[] = [
  {
    id: 1,
    operator: "HOLO",
    message: "Demande de paiement 3 000 KMF reçue. Confirmez l'opération sur HOLO.",
    time: "Il y a 2 minutes",
    type: "info",
  },
  {
    id: 2,
    operator: "HOLO",
    message: "Paiement 3 000 KMF effectué avec succès. Réf AMG-2456.",
    time: "Il y a 1 heure",
    type: "success",
  },
  {
    id: 3,
    operator: "HURI",
    message: "Paiement non effectué. Solde insuffisant. Réessayez.",
    time: "Hier à 14:30",
    type: "error",
  },
  {
    id: 4,
    operator: "MVOLA",
    message: "Votre couverture AMG est maintenant active. Profitez de vos droits !",
    time: "Il y a 2 jours",
    type: "success",
  },
];

const Notifications = () => {
  const navigate = useNavigate();

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return "border-l-4 border-l-success bg-success/5";
      case "error":
        return "border-l-4 border-l-destructive bg-destructive/5";
      default:
        return "border-l-4 border-l-primary bg-primary/5";
    }
  };

  const getOperatorEmoji = (operator: string) => {
    switch (operator) {
      case "HOLO":
        return "🟢";
      case "HURI":
        return "🟣";
      case "MVOLA":
        return "🟠";
      default:
        return "📱";
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
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-primary-foreground/80 mt-2">
            Messages de vos opérateurs mobiles
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 animate-fade-in ${getTypeStyles(notification.type)}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getOperatorEmoji(notification.operator)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{notification.operator}</span>
                    <span className="text-xs text-muted-foreground">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{notification.message}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-6 p-4 bg-muted/50 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Les notifications SMS sont envoyées automatiquement par votre opérateur
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
