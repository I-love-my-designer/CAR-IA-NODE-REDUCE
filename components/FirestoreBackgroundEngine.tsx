import React, { useEffect, useState, useRef } from 'react';
import { 
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { db, resolveBackgroundUrl } from '../services/firebaseService';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, Radio } from 'lucide-react';

interface ActiveJob {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  errorMessage?: string;
}

const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // strict max 1000px width limit
        if (width > 1000) {
          height = Math.round((height * 1000) / width);
          width = 1000;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str); // Fallback
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG Quality 0.75 - 0.80
        const jpegBase64 = canvas.toDataURL('image/jpeg', 0.80);
        resolve(jpegBase64);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Erreur de chargement pour la compression"));
    img.src = base64Str;
  });
};

const getCleanBase64 = (str: string): string => {
  if (!str) return '';
  if (str.startsWith('data:')) {
    const parts = str.split(';base64,');
    if (parts.length > 1) {
      return parts[1];
    }
  }
  return str;
};

const getMimeType = (str: string, defaultType: string = 'image/png'): string => {
  if (!str) return defaultType;
  if (str.startsWith('data:')) {
    const m = str.match(/data:([^;]+);/);
    if (m && m[1]) {
      return m[1];
    }
  }
  if (str.includes('<svg')) return 'image/svg+xml';
  return defaultType;
};

export const FirestoreBackgroundEngine: React.FC = () => {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [lastNotification, setLastNotification] = useState<{ id: string; status: 'completed' | 'failed' } | null>(null);
  const processingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, 'exports'),
      where('status', '==', 'pending'),
      limit(15)
    );

    console.log("Listening to 'exports' collection for pending sublimation requests...");

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        const docId = docSnap.id;
        const data = docSnap.data();

        if (data.status === 'pending' && !processingIds.current.has(docId)) {
          console.log("Automating Flow: Received pending mobile job, processing via Gemini. Job ID:", docId);
          processSublimation(docId, data);
        }
      });
    }, (error) => {
      console.error("Firestore Background Engine Snapshot Error:", error);
    });

    return () => unsubscribe();
  }, []);

  const processSublimation = async (docId: string, data: any) => {
    processingIds.current.add(docId);
    setActiveJobs(prev => [...prev, { id: docId, status: 'processing' }]);
    const docRef = doc(db, 'exports', docId);

    try {
      const finalImageA = data.imageA || (data.backgroundId ? resolveBackgroundUrl(data.backgroundId) : '');
      const finalImageB = data.imageB || data.vehicleImage || '';
      const finalImageC = data.imageC || data.roughComposite || '';
      const rotation = data.rotation || 0;

      if (!finalImageA || !finalImageB || !finalImageC) {
        throw new Error("Champs obligatoires manquants : imageA (arrière-plan), imageB (véhicule), ou imageC (composition de référence) sont vides.");
      }

      // Instantly notify PWA that processing has commenced
      await updateDoc(docRef, {
        status: 'processing',
        updatedAt: serverTimestamp()
      });

      const res = await fetch('/api/sublimation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageA: finalImageA, imageB: finalImageB, imageC: finalImageC, rotation })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erreur serveur lors de la sublimation (${res.status})`);
      }

      const { imageFinal } = await res.json();
      if (!imageFinal) {
        throw new Error("Le serveur n'a renvoyé aucune image compilée.");
      }

      // Compress generated image to JPEG, max 1000px width, quality 0.8
      const compressedImage = await compressImage(imageFinal);

      // Write results to database
      await updateDoc(docRef, {
        status: 'completed',
        imageFinal: compressedImage,
        updatedAt: serverTimestamp()
      });

      setActiveJobs(prev => prev.filter(j => j.id !== docId));
      processingIds.current.delete(docId);

      // Trigger short completion animation
      setLastNotification({ id: docId, status: 'completed' });
      setTimeout(() => setLastNotification(null), 6000);

    } catch (err: any) {
      console.error("Sublimation Error on job:", docId, err);
      
      try {
        await updateDoc(docRef, {
          status: 'failed',
          errorMessage: err.message || String(err),
          errorMessage5: err.message || String(err),
          updatedAt: serverTimestamp()
        });
      } catch (dbErr) {
        console.error("Impossible d'actualiser le statut d'échec sur Firestore:", dbErr);
      }

      setActiveJobs(prev => prev.filter(j => j.id !== docId));
      processingIds.current.delete(docId);

      setLastNotification({ id: docId, status: 'failed' });
      setTimeout(() => setLastNotification(null), 6000);
    }
  };

  const isProcessing = activeJobs.length > 0;

  return (
    <div className="fixed bottom-6 right-6 z-[1000] font-sans text-xs selection:bg-white/10 select-none">
      {isMinimized ? (
        <button 
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2 px-3.5 py-2.5 bg-black/90 border border-white/10 rounded-full shadow-2xl backdrop-blur-md hover:border-white/20 transition-all ${isProcessing ? 'animate-pulse text-blue-400' : 'text-slate-400'}`}
        >
          {isProcessing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Radio size={13} className="text-emerald-500 animate-pulse" />
          )}
          <span className="font-bold tracking-widest text-[9px] uppercase">
            {isProcessing ? 'Sublimation...' : 'PWA Sync'}
          </span>
        </button>
      ) : (
        <div className="w-[300px] bg-black/90 border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isProcessing ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isProcessing ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                </span>
              </div>
              <span className="font-black text-[9px] uppercase tracking-widest text-slate-300">Moteur de Sublimation PWA</span>
            </div>
            <button 
              onClick={() => setIsMinimized(true)}
              className="text-[9px] uppercase tracking-widest text-slate-500 hover:text-white transition-colors border border-white/5 bg-white/5 rounded px-1.5 py-0.5"
            >
              Réduire
            </button>
          </div>

          <div className="h-px bg-white/5 w-full"></div>

          {activeJobs.length === 0 && !lastNotification ? (
            <div className="flex items-center gap-2 text-[10px] text-slate-400 py-1">
              <Radio size={12} className="text-emerald-400 animate-pulse shrink-0" />
              <span>Écoute active de la collection <span className="font-mono text-emerald-300">exports</span>...</span>
            </div>
          ) : null}

          {/* Active processing workflow */}
          {activeJobs.map((job) => (
            <div key={job.id} className="flex flex-col gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-300 animate-pulse">
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <Loader2 size={12} className="animate-spin" />
                <span>Traitement du véhicule en arrière-plan...</span>
              </div>
              <div className="text-[9px] font-mono opacity-60 overflow-hidden text-ellipsis whitespace-nowrap">
                ID: {job.id}
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 animate-[loading_2s_infinite]"></div>
              </div>
            </div>
          ))}

          {/* Complete/Fail notification banner */}
          {lastNotification && (
            <div className={`flex flex-col gap-1.5 rounded-lg p-3 border animate-in fade-in slide-in-from-bottom duration-300 ${
              lastNotification.status === 'completed' 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                {lastNotification.status === 'completed' ? (
                  <>
                    <CheckCircle2 size={12} className="shrink-0" />
                    <span>Calcul complété !</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>Échec du traitement</span>
                  </>
                )}
              </div>
              <div className="text-[9px] font-mono opacity-80 overflow-hidden text-ellipsis whitespace-nowrap">
                Job: {lastNotification.id}
              </div>
              <p className="text-[9px] leading-relaxed opacity-70">
                {lastNotification.status === 'completed' 
                  ? 'L\'image a été fusionnée avec succès et renvoyée compressée à la PWA.' 
                  : 'Une erreur est survenue lors de l\'intégration de l\'image par l\'IA.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
