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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse-soft" />
      
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
            Notifications
          </h1>
          <p className="text-primary-foreground/80 text-sm md:text-base animate-fade-in-left" style={{ animationDelay: '0.1s' }}>
            Messages et alertes de vos opérateurs mobiles
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-8 pb-12 relative z-10">
        <div className="space-y-4">
          {notifications.map((notification, index) => (
            <Card
              key={notification.id}
              className={`group p-6 animate-fade-in hover-lift transition-all duration-300 rounded-2xl overflow-hidden ${getTypeStyles(notification.type)}`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start gap-4">
                {/* Operator Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-turquoise/10 flex items-center justify-center text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  {getOperatorEmoji(notification.operator)}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-foreground">{notification.operator}</span>
                    <span className="text-xs text-muted-foreground px-3 py-1 bg-muted/50 rounded-full">
                      {notification.time}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {notification.message}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Banner */}
        <Card className="mt-8 p-6 bg-gradient-to-r from-accent/5 to-transparent border-2 border-accent/20 rounded-2xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-2">Notifications SMS</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Les notifications SMS sont envoyées automatiquement par votre opérateur pour chaque transaction. 
                Elles vous permettent de suivre l'état de vos paiements en temps réel.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
