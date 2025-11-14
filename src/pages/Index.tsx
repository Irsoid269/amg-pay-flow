import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Login from "./Login";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Clear old localStorage
      localStorage.removeItem("insuranceNumber");
      
      // Check if user is already logged in with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        navigate("/dashboard");
      } else {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return <Login />;
};

export default Index;
