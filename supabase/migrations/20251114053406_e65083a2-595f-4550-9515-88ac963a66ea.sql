-- Supprimer l'ancienne politique d'insertion
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Créer une nouvelle politique d'insertion qui permet l'insertion lors de la création du compte
-- Cette politique permet à un utilisateur authentifié d'insérer son propre profil
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Créer une politique supplémentaire pour permettre l'insertion lors du signup
-- via l'authentification service_role (utilisé par signUp)
CREATE POLICY "Service role can insert profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- Ajouter un commentaire pour clarifier
COMMENT ON POLICY "Service role can insert profiles" ON public.profiles 
IS 'Allows profile creation during signup process';