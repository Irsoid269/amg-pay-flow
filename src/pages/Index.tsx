import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Login from "./Login";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is already logged in with Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log('Index - Session check:', session ? 'Logged in' : 'Not logged in');
        
        if (session) {
          console.log('Index - Redirecting to dashboard');
          navigate("/dashboard", { replace: true });
        } else {
          setIsChecking(false);
        }
      } catch (error) {
        console.error('Index - Auth check error:', error);
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
