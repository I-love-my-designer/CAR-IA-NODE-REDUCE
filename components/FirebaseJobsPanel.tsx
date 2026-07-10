
import React, { useEffect, useState } from 'react';
import { subscribeToJobs, updateJobStatus, deleteJob, createTestJob } from '../services/firebaseService';
import firebaseConfig from '../firebase-applet-config.json';
import { CompositingJob } from '../types';
import { 
  Bell, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Trash2,
  Car,
  Image as ImageIcon,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FirebaseJobsPanelProps {
  onInjectJob: (job: CompositingJob) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseJobsPanel: React.FC<FirebaseJobsPanelProps> = ({ onInjectJob, isOpen, onClose }) => {
  const [jobs, setJobs] = useState<CompositingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onInjectJobRef = React.useRef(onInjectJob);
  useEffect(() => {
    onInjectJobRef.current = onInjectJob;
  }, [onInjectJob]);

  const injectedJobsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    setError(null);
    setLoading(true);
    const unsubscribe = subscribeToJobs(
      (newJobs) => {
        // Filter list to keep only the latest active session/jobs
        // This hides all older completed sessions as well as stale stuck jobs
        const filterLatestSessionJobs = (allJobs: CompositingJob[]): CompositingJob[] => {
          if (allJobs.length === 0) return [];
          
          // Since jobs are ordered desc, allJobs[0] is the absolute latest job.
          const latestJob = allJobs[0];
          
          if (latestJob.status === 'completed') {
            // If the latest job is already completed, show only this completed job.
            return [latestJob];
          } else {
            // The latest job is pending/processing/error.
            // Show this latest job, and the first completed job we find after it as the previous session.
            const result: CompositingJob[] = [latestJob];
            const prevCompleted = allJobs.slice(1).find(j => j.status === 'completed');
            if (prevCompleted) {
              result.push(prevCompleted);
            }
            return result;
          }
        };

        const filtered = filterLatestSessionJobs(newJobs);
        setJobs(filtered);
        setLoading(false);
        setError(null);

        // Auto-inject the latest pending job automatically as soon as it arrives
        const pendingJob = filtered.find(j => j.status === 'pending');
        if (pendingJob) {
          if (!injectedJobsRef.current.has(pendingJob.id)) {
            console.log("Automating Flow: New pending job detected, auto-injecting into the graph:", pendingJob.id);
            injectedJobsRef.current.add(pendingJob.id);
            onInjectJobRef.current(pendingJob);
          }
        }
      },
      (err) => {
        setError(err.message || "Impossible de se connecter à la base de données.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const getStatusIcon = (status: CompositingJob['status']) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="text-amber-400" />;
      case 'processing': return <Loader2 size={14} className="text-blue-400 animate-spin" />;
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'error': return <AlertCircle size={14} className="text-rose-400" />;
    }
  };

  const getStatusLabel = (status: CompositingJob['status']) => {
    switch (status) {
      case 'pending': return 'Nouveau';
      case 'processing': return 'En cours';
      case 'completed': return 'Terminé';
      case 'error': return 'Erreur';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-gray-900 border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-400" />
          <h2 className="text-xs font-black uppercase tracking-widest">Flux Mobile (PWA)</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => createTestJob({ status: 'pending', backgroundId: 'TEST_BG', vehicleImage: 'https://images.unsplash.com/photo-1542362567-b05200f90641?q=80&w=200&auto=format&fit=crop' })}
            className="p-1.5 hover:bg-white/10 rounded-md text-[8px] font-black uppercase text-blue-400 border border-blue-500/20 transition-all"
            title="Générer un job de test"
          >
            TEST
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-full transition-colors">
            <ChevronRight size={20} className="text-white/40" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
            <div className="flex items-start gap-2 text-rose-400">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-[10px] font-black uppercase tracking-wider">Erreur de Synchronisation</div>
            </div>
            <p className="text-[9px] text-white/75 leading-relaxed">
              Le flux ne parvient pas à se synchroniser avec Firestore.
            </p>
            <div className="bg-black/40 rounded-lg p-2.5 font-mono text-[8px] text-white/60 space-y-1 select-all">
              <div className="text-rose-400/85 overflow-hidden text-ellipsis whitespace-nowrap" title={error}>Détail : {error}</div>
              <div className="border-t border-white/5 my-1.5 pt-1.5 font-sans font-black text-[7px] text-white/40 uppercase tracking-widest">Configuration Active :</div>
              <div>PROJET : {firebaseConfig.projectId}</div>
              <div>BASE ID : {firebaseConfig.firestoreDatabaseId}</div>
            </div>
            <p className="text-[8px] text-blue-400/80 leading-normal font-medium">
              💡 <strong>Solution :</strong> Pour que vos 2 applications communiquent, elles <strong>doivent</strong> partager le même fichier <code>firebase-applet-config.json</code>. Copiez le fichier de cette app vers votre autre projet.
            </p>
          </div>
        ) : loading ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <Loader2 size={32} className="animate-spin mb-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Synchro...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-8">
            <Car size={48} className="mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed">
              Aucune demande de véhicule en attente
            </p>
          </div>
        ) : (
          jobs.map((job) => (
            <div 
              key={job.id} 
              className={`group relative p-3 rounded-xl border transition-all hover:shadow-xl hover:-translate-y-0.5 ${
                job.status === 'pending' 
                  ? 'bg-blue-500/5 border-blue-500/20' 
                  : 'bg-white/5 border-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/5">
                  {getStatusIcon(job.status)}
                  <span className="text-[8px] font-black uppercase tracking-tighter text-white/60">
                    {getStatusLabel(job.status)}
                  </span>
                </div>
                <button 
                  onClick={() => deleteJob(job.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-white/20 hover:text-rose-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="aspect-square rounded-lg bg-black/40 border border-white/5 overflow-hidden relative group/thumb">
                  {job.vehicleImage ? (
                    <img src={job.vehicleImage} className="w-full h-full object-contain p-1" alt="Vehicle" />
                  ) : <div className="w-full h-full flex items-center justify-center"><Car size={12} className="text-white/10" /></div>}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[6px] font-black uppercase text-white/60">DÉTOURÉ</span>
                  </div>
                </div>
                <div className="aspect-square rounded-lg bg-black/40 border border-white/5 overflow-hidden relative group/thumb">
                  {job.imageA ? (
                    <img src={job.imageA} className="w-full h-full object-contain p-1" alt="Background" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <span className="text-[8px] font-black text-blue-400">{job.backgroundId}</span>
                      <span className="text-[6px] font-black uppercase text-white/20 text-center px-1">BACKDROP</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[6px] font-black uppercase text-white/60">DÉCOR</span>
                  </div>
                </div>
                <div className="aspect-square rounded-lg bg-black/40 border border-white/5 overflow-hidden relative group/thumb">
                  {job.roughComposite ? (
                    <img src={job.roughComposite} className="w-full h-full object-contain p-1" alt="Composite" />
                  ) : <div className="w-full h-full flex items-center justify-center"><Layers size={12} className="text-white/10" /></div>}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[6px] font-black uppercase text-white/60">REF A01</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => onInjectJob(job)}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 group/btn"
              >
                <ArrowRight size={14} className="group-hover/btn:translate-x-0.5 transition-transform" />
                <span className="text-[9px] font-black uppercase tracking-widest">Injecter dans le Graphe</span>
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="p-4 bg-black/40 border-t border-white/10">
        <p className="text-[8px] text-white/20 text-center uppercase tracking-widest leading-loose">
          Connecté à Firestore<br/>
          <span className="text-blue-500/40">{new Date().toLocaleTimeString()}</span>
        </p>
      </div>
    </div>
  );
};
