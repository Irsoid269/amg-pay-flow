import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Login from "./Login";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const insuranceNumber = localStorage.getItem("insuranceNumber");
    if (insuranceNumber) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return <Login />;
};

export default Index;
