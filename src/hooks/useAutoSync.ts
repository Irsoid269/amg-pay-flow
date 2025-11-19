import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAutoSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const enableAutoSync = import.meta.env.VITE_ENABLE_AUTO_SYNC === 'true';

  useEffect(() => {
    checkAndSync();
  }, []);

  const checkAndSync = async () => {
    try {
      console.log('🔍 Checking if sync is needed...');

      // Check if there are any contracts in the database
      const { count, error: countError } = await supabase
        .from('amg_contracts')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('Error checking contracts:', countError);
        return;
      }

      // Check last sync status
      const { data: lastSync, error: syncError } = await supabase
        .from('amg_sync_status')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (syncError && syncError.code !== 'PGRST116') {
        console.error('Error checking sync status:', syncError);
        return;
      }

      const shouldSync = !count || 
                         count === 0 || 
                         !lastSync ||
                         lastSync.status === 'error' ||
                         (lastSync.sync_completed_at && 
                          new Date().getTime() - new Date(lastSync.sync_completed_at).getTime() > 24 * 60 * 60 * 1000);

      if (shouldSync) {
        console.log('⚠️ Sync needed - starting automatic synchronization...');
        if (!enableAutoSync) {
          console.log('🚫 Auto-sync disabled via VITE_ENABLE_AUTO_SYNC');
          return;
        }

        if (!lastSync || lastSync.status !== 'in_progress') {
          toast.info('Synchronisation automatique', {
            description: 'Mise à jour des données AMG en cours...',
            duration: 5000,
          });
          
          await startSync();
        } else {
          console.log('⏳ Sync already in progress');
          setIsSyncing(true);
        }
      } else {
        console.log('✅ Database is up to date');
        if (lastSync?.sync_completed_at) {
          setLastSyncTime(new Date(lastSync.sync_completed_at));
        }
      }
    } catch (error) {
      console.error('Error in auto-sync check:', error);
    }
  };

  const startSync = async () => {
    try {
      setIsSyncing(true);

      // Call the sync function without waiting for completion
      supabase.functions
        .invoke('amg-sync-contracts', { body: {} })
        .then(({ data, error }) => {
          if (error) {
            console.error('Sync error:', error);
            toast.error('Erreur de synchronisation', {
              description: 'La synchronisation automatique a échoué.',
            });
          } else {
            console.log('✅ Sync completed:', data);
            toast.success('Synchronisation terminée', {
              description: `${data.totalContractsProcessed} contrats synchronisés`,
            });
            setLastSyncTime(new Date());
          }
          setIsSyncing(false);
        })
        .catch((err) => {
          console.error('Functions network error during sync:', err);
          toast.error('Erreur réseau fonction', {
            description: 'Impossible de contacter la fonction de synchronisation.',
          });
          setIsSyncing(false);
        });

    } catch (error) {
      console.error('Error starting sync:', error);
      setIsSyncing(false);
    }
  };

  return { isSyncing, lastSyncTime, checkAndSync };
};
