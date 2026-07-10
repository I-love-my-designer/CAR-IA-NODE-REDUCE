
import React, { useEffect, useState, useRef } from 'react';
import { NodeGraph } from './components/NodeGraph';
import { FirebaseJobsPanel } from './components/FirebaseJobsPanel';
import { FirestoreBackgroundEngine } from './components/FirestoreBackgroundEngine';
import { WorkspaceStats, CompositingJob } from './types';
import { Undo2, Download as DownloadIcon, Upload as UploadIcon, Check, Bell } from 'lucide-react';
import { updateJobStatus } from './services/firebaseService';

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [stats, setStats] = useState<WorkspaceStats>({ totalTokens: 0, totalCost: 0 });
  const [workspaceName, setWorkspaceName] = useState<string>('WORKSPACE_1');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isJobsOpen, setIsJobsOpen] = useState<boolean>(false);
  const nodeGraphRef = useRef<{ undo: () => void, exportToJSON: (fileName?: string) => void, importFromJSON: (data: any) => void, injectJob: (job: CompositingJob) => void }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKeySelection = async () => {
      try {
        const aistudio = (window as any).aistudio;
        if (aistudio && typeof aistudio.hasSelectedApiKey === 'function') {
          const selected = await aistudio.hasSelectedApiKey();
          setHasKey(selected);
        }
      } catch (err) {
        console.warn("Vérification de clé API reportée:", err);
      }
    };
    checkKeySelection();
  }, []);

  const handleKeySelection = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio && typeof aistudio.openSelectKey === 'function') {
      try {
        await aistudio.openSelectKey();
        setHasKey(true);
      } catch (err) {
        console.error("Erreur lors de l'ouverture du sélecteur de clé:", err);
      }
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        nodeGraphRef.current?.importFromJSON(json);
      } catch (err) {
        console.error("Failed to parse JSON:", err);
        alert("Fichier JSON invalide.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInjectJob = async (job: CompositingJob) => {
    if (nodeGraphRef.current) {
      nodeGraphRef.current.injectJob(job);
      // If the job is pending, set it to 'processing' (En cours) so we track that the studio is working on it.
      // Otherwise, keep its current status to preserve history correctly.
      const targetStatus = job.status === 'pending' ? 'processing' : job.status;
      await updateJobStatus(job.id, targetStatus, { studioNotes: 'Job injecté dans le Studio.' });
    }
  };

  return (
    <div className="w-screen h-screen bg-gray-950 flex flex-col text-white font-sans overflow-hidden">
      {!hasKey && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto shadow-2xl shadow-blue-500/20"></div>
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight uppercase">Accès Studio</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Pour utiliser Gemini 3 Pro et les rendus haute résolution, vous devez sélectionner votre clé API payante.
              </p>
              <p className="text-[10px] text-blue-400/60 uppercase tracking-widest">
                Documentation: <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-400 transition-colors">ai.google.dev/gemini-api/docs/billing</a>
              </p>
            </div>
            <div className="pt-6">
              <button onClick={handleKeySelection} className="w-full py-5 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-transform active:scale-95 shadow-2xl">Sélectionner une Clé API</button>
            </div>
          </div>
        </div>
      )}

      <header className="h-14 border-b border-white/5 flex items-center px-6 bg-black z-10">
        <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-md"></div>
            <span className="font-black text-sm uppercase tracking-widest">NodeGen <span className="text-white/20">Studio</span></span>
        </div>

        <div className="flex-1" />

        <div className="ml-auto flex items-center gap-4 shrink-0">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".json" 
              className="hidden" 
            />
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value.slice(0, 20))}
                  disabled={!isExporting}
                  className={`bg-transparent border-none outline-none text-[9px] font-black tracking-widest uppercase w-[125px] transition-colors ${isExporting ? 'text-white' : 'text-white/20'}`}
                  placeholder="NOM..."
                />
                {!isExporting ? (
                  <button 
                    onClick={() => setIsExporting(true)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all group"
                    title="Exporter Workspace (JSON)"
                  >
                    <DownloadIcon size={14} className="group-active:scale-90 transition-transform" />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      nodeGraphRef.current?.exportToJSON(workspaceName);
                      setIsExporting(false);
                    }}
                    className="p-1.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 transition-all group"
                    title="Valider l'export"
                  >
                    <Check size={14} className="group-active:scale-90 transition-transform" />
                  </button>
                )}
              </div>
              <div className="w-px h-3 bg-white/10"></div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all group"
                title="Importer Workspace (JSON)"
              >
                <UploadIcon size={14} className="group-active:scale-90 transition-transform" />
              </button>
            </div>

            <button 
              onClick={() => setIsJobsOpen(!isJobsOpen)}
              className={`p-2 rounded-full border transition-all group relative ${isJobsOpen ? 'bg-blue-500 border-blue-400 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
              title="Flux Mobile (PWA)"
            >
              <Bell size={14} className={isJobsOpen ? '' : 'group-active:scale-90 transition-transform'} />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-gray-950 animate-pulse"></div>
            </button>
            <button 
              onClick={() => nodeGraphRef.current?.undo()}
              className="p-2 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all group"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={14} className="group-active:scale-90 transition-transform" />
            </button>
            <button 
              onClick={handleKeySelection}
              className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all"
            >
              Clé API
            </button>
        </div>
      </header>
      <main className="flex-1 relative bg-[#0a0a0c]">
        <NodeGraph ref={nodeGraphRef} onStatsChange={setStats} />
        
        <FirebaseJobsPanel 
          isOpen={isJobsOpen} 
          onClose={() => setIsJobsOpen(false)} 
          onInjectJob={handleInjectJob}
        />

        <FirestoreBackgroundEngine />
      </main>
    </div>
  );
};

export default App;

