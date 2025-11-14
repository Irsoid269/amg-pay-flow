-- Supprimer la politique trop permissive
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- Recréer la politique d'insertion avec une meilleure sécurité
-- Permet uniquement l'insertion si l'ID correspond à l'utilisateur authentifié
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);