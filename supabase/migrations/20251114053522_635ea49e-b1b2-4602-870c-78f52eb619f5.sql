-- Fonction pour créer automatiquement un profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, insurance_number, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'insurance_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Si le profil existe déjà, ne rien faire
    RETURN NEW;
END;
$$;

-- Créer le trigger qui s'exécute après l'insertion d'un nouvel utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();