import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Login from "./Login";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        // Vérifier si les données d'assurance sont stockées
        const storedData = localStorage.getItem('amg_insurance_data');
        
        console.log('Index - Checking stored data:', storedData ? 'Found' : 'Not found');
        
        if (storedData) {
          const insuranceData = JSON.parse(storedData);
          
          // Vérifier que les données ne sont pas trop anciennes (24h)
          const maxAge = 24 * 60 * 60 * 1000;
          if (Date.now() - insuranceData.timestamp <= maxAge) {
            console.log('Index - Valid data found, redirecting to dashboard');
            navigate("/dashboard", { replace: true });
            return;
          } else {
            console.log('Index - Data expired, clearing storage');
            localStorage.removeItem('amg_insurance_data');
          }
        }
        
        setIsChecking(false);
      } catch (error) {
        console.error('Index - Auth check error:', error);
        localStorage.removeItem('amg_insurance_data');
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
        <p className="text-muted-foreground">Vérification...</p>
      </div>
    );
  }

  return <Login />;
};

export default Index;
