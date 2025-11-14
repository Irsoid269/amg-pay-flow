import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [lastSync, setLastSync] = useState<any>(null);

  useEffect(() => {
    fetchLastSync();
  }, []);

  const fetchLastSync = async () => {
    const { data, error } = await supabase
      .from('amg_sync_status')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      setLastSync(data);
    }
  };

  const startSync = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus({ status: 'starting', message: 'Démarrage de la synchronisation...' });

      toast.info("Synchronisation lancée", {
        description: "La synchronisation des contrats AMG va prendre plusieurs minutes.",
      });

      const { data, error } = await supabase.functions.invoke('amg-sync-contracts', {
        body: {},
      });

      if (error) {
        throw error;
      }

      setSyncStatus({
        status: 'completed',
        message: 'Synchronisation terminée avec succès!',
        data,
      });

      toast.success("Synchronisation réussie", {
        description: `${data.totalContractsProcessed} contrats synchronisés`,
      });

      await fetchLastSync();
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus({
        status: 'error',
        message: error.message || 'Erreur lors de la synchronisation',
      });

      toast.error("Erreur de synchronisation", {
        description: "Une erreur est survenue lors de la synchronisation.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const getProgressPercentage = () => {
    if (!lastSync || !lastSync.total_contracts) return 0;
    return Math.round((lastSync.contracts_synced / lastSync.total_contracts) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Synchronisation AMG</h1>
          <p className="text-muted-foreground">
            Synchroniser tous les contrats AMG vers la base de données locale pour des recherches instantanées
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lancer la synchronisation</CardTitle>
            <CardDescription>
              Cette opération va récupérer tous les contrats depuis l'API AMG et les stocker dans Supabase.
              Cela peut prendre plusieurs minutes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={startSync}
              disabled={isSyncing}
              size="lg"
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Synchronisation en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Lancer la synchronisation
                </>
              )}
            </Button>

            {syncStatus && (
              <div className={`flex items-start gap-3 p-4 rounded-lg ${
                syncStatus.status === 'completed' ? 'bg-green-500/10 border border-green-500/20' :
                syncStatus.status === 'error' ? 'bg-destructive/10 border border-destructive/20' :
                'bg-primary/10 border border-primary/20'
              }`}>
                {syncStatus.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />}
                {syncStatus.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />}
                {syncStatus.status === 'starting' && <Loader2 className="h-5 w-5 animate-spin text-primary mt-0.5" />}
                <div className="flex-1">
                  <p className="font-medium">{syncStatus.message}</p>
                  {syncStatus.data && (
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      <p>Contrats traités: {syncStatus.data.totalContractsProcessed}</p>
                      <p>Pages parcourues: {syncStatus.data.pagesProcessed}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {lastSync && (
          <Card>
            <CardHeader>
              <CardTitle>Dernière synchronisation</CardTitle>
              <CardDescription>
                {new Date(lastSync.sync_started_at).toLocaleString('fr-FR')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">
                    {lastSync.contracts_synced} / {lastSync.total_contracts} contrats
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Statut</p>
                  <p className="font-medium capitalize">
                    {lastSync.status === 'completed' && (
                      <span className="text-green-500">Terminée</span>
                    )}
                    {lastSync.status === 'in_progress' && (
                      <span className="text-primary">En cours</span>
                    )}
                    {lastSync.status === 'error' && (
                      <span className="text-destructive">Erreur</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Durée</p>
                  <p className="font-medium">
                    {lastSync.sync_completed_at
                      ? `${Math.round((new Date(lastSync.sync_completed_at).getTime() - new Date(lastSync.sync_started_at).getTime()) / 1000)}s`
                      : 'En cours...'}
                  </p>
                </div>
              </div>

              {lastSync.error_message && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{lastSync.error_message}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
