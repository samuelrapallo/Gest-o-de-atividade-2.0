
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Trash2, 
  Download, 
  Upload, 
  Search, 
  Info, 
  LogIn, 
  LogOut, 
  CheckCircle, 
  Clock, 
  RotateCcw,
  Share2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Task, TaskStatus, GoogleUser } from './types';
import { DashboardCharts } from './components/DashboardCharts';
import { VoiceRecorder } from './components/VoiceRecorder';
import { getSmartInstructions } from './services/geminiService';

declare const google: any;

// AVISO: Substitua este ID pelo seu Client ID do Google Cloud Console (https://console.cloud.google.com)
// O erro 401 "invalid_client" ocorre porque este ID é apenas um exemplo ou não está autorizado para este domínio.
const GOOGLE_CLIENT_ID = "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com";

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeObservation, setActiveObservation] = useState<{ id: string, type: TaskStatus } | null>(null);
  const [obsText, setObsText] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionContent, setInstructionContent] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    const savedTasks = localStorage.getItem('executive_tasks');
    const savedUser = localStorage.getItem('executive_user');
    
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedUser) setUser(JSON.parse(savedUser));
    
    if (window.location.hash.includes('share=true')) {
      setViewOnly(true);
    }
  }, []);

  // Sync tasks to localStorage
  useEffect(() => {
    localStorage.setItem('executive_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Sync user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('executive_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('executive_user');
    }
  }, [user]);

  // Google Login Initialization
  useEffect(() => {
    const initGsi = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCallbackResponse,
            ux_mode: 'popup',
          });

          const renderLoginButton = () => {
            const btn = document.getElementById("googleSignInBtn");
            const headerBtn = document.getElementById("headerGoogleSignInBtn");
            
            if (btn) {
              google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: 250 });
            }
            if (headerBtn) {
              google.accounts.id.renderButton(headerBtn, { theme: "outline", size: "medium", width: 200 });
            }
          };

          if (!user && !viewOnly) {
            renderLoginButton();
          }
        } catch (err) {
          console.error("GSI Init error:", err);
          setLoginError("Erro ao inicializar o Google Sign-In.");
        }
      } else {
        setTimeout(initGsi, 500);
      }
    };

    initGsi();
  }, [user, viewOnly]);

  const handleCallbackResponse = (response: any) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const googleUser: GoogleUser = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        sub: payload.sub
      };
      setUser(googleUser);
      setLoginError(null);
    } catch (e) {
      console.error("Error decoding Google credential", e);
      setLoginError("Erro ao processar login do Google.");
    }
  };

  // Fallback para permitir uso administrativo caso o ID do Google esteja incorreto ou em ambiente restrito
  const handleAdminFallback = () => {
    const mockUser: GoogleUser = {
      name: "Administrador (Demo)",
      email: "admin@gestor.executivo",
      picture: "https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff",
      sub: "mock-123"
    };
    setUser(mockUser);
    setLoginError(null);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('executive_user');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const mappedTasks: Task[] = data.map((row: any, idx) => ({
        id: Math.random().toString(36).substr(2, 9),
        atividade: row['ATIVIDADES'] || row['Atividade'] || row['Atividades'] || 'N/A',
        ordem: String(row['ORDEM'] || row['número da ordem'] || row['Ordem'] || idx + 1),
        data: row['DATA'] || row['dados'] || row['Data'] || new Date().toLocaleDateString(),
        executante: row['EXECUTANTE'] || row['nome do executante'] || row['Executante'] || 'Não atribuído',
        status: TaskStatus.PENDING,
        observacoes: '',
        updatedAt: Date.now()
      }));

      setTasks(mappedTasks);
    };
    reader.readAsBinaryString(file);
  };

  const clearData = () => {
    if (window.confirm('Tem certeza que deseja apagar todos os dados da planilha?')) {
      setTasks([]);
      localStorage.removeItem('executive_tasks');
    }
  };

  const updateStatus = (id: string, status: TaskStatus, obs: string = '') => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status, observacoes: obs || t.observacoes, updatedAt: Date.now() } : t
    ));
    setActiveObservation(null);
    setObsText('');
  };

  const undoStatus = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: TaskStatus.PENDING, updatedAt: Date.now() } : t
    ));
  };

  const filteredTasks = useMemo(() => {
    const s = search.toLowerCase();
    return tasks.filter(t => 
      t.atividade.toLowerCase().includes(s) || 
      t.executante.toLowerCase().includes(s) || 
      t.ordem.toLowerCase().includes(s)
    );
  }, [tasks, search]);

  const exportReport = () => {
    const ws = XLSX.utils.json_to_sheet(tasks);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `Relatorio_Atividades_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const generateShareLink = () => {
    const baseUrl = window.location.href.split('#')[0];
    const shareUrl = `${baseUrl}#share=true`;
    navigator.clipboard.writeText(shareUrl);
    alert('Link de compartilhamento copiado! Qualquer pessoa com este link poderá visualizar as atualizações.');
  };

  const handleShowInstructions = async (task?: Task) => {
    setInstructionContent('Carregando sugestões inteligentes...');
    setShowInstructions(true);
    const context = task ? `Tarefa: ${task.atividade} para ${task.executante}` : 'Visão geral do sistema de gestão executiva';
    const msg = await getSmartInstructions(context);
    setInstructionContent(msg);
  };

  const isAdmin = !!user;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="text-blue-600" />
            Gestor Executivo
          </h1>
          <p className="text-gray-500 text-sm">Controle e acompanhamento de atividades operacionais</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          {isAdmin ? (
            <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 mr-2">
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-white shadow-sm" />
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-gray-700 leading-none">{user.name}</p>
                <p className="text-[10px] text-gray-500">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : !viewOnly && (
            <div id="headerGoogleSignInBtn" className="h-10 min-w-[200px]"></div>
          )}
          
          {isAdmin && (
            <>
              <label className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium">
                <Upload size={18} />
                Carregar Planilha
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              </label>
              <button onClick={clearData} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
                <Trash2 size={18} />
                Limpar
              </button>
              <button onClick={generateShareLink} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
                <Share2 size={18} />
                Gerar Link
              </button>
            </>
          )}

          <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium">
            <Download size={18} />
            Exportar
          </button>
          
          <button onClick={() => handleShowInstructions()} className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium">
            <Info size={18} />
            Ajuda
          </button>
        </div>
      </header>

      {tasks.length > 0 ? (
        <>
          <DashboardCharts tasks={tasks} />

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <Search className="text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por atividade, executante ou número da ordem..."
              className="w-full bg-transparent border-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Task Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ordem</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Atividade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Executante</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">#{task.ordem}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <div className="max-w-md">
                          <p className="font-medium">{task.atividade}</p>
                          {task.observacoes && (
                            <div className="mt-2 text-xs text-blue-600 bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex items-start gap-2">
                              <Info size={12} className="mt-0.5 shrink-0" />
                              <span className="italic">"{task.observacoes}"</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                            {task.executante.substring(0, 2)}
                          </div>
                          {task.executante}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.data}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight ${
                          task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                          task.status === TaskStatus.RESCHEDULED ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          {task.status === TaskStatus.PENDING ? (
                            <>
                              <button 
                                onClick={() => setActiveObservation({ id: task.id, type: TaskStatus.COMPLETED })}
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                                title="Marcar como Concluído"
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button 
                                onClick={() => setActiveObservation({ id: task.id, type: TaskStatus.RESCHEDULED })}
                                className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                                title="Reprogramar Atividade"
                              >
                                <Clock size={18} />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => undoStatus(task.id)}
                              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
                              title="Resetar Status para Pendente"
                            >
                              <RotateCcw size={16} />
                              <span className="text-xs">Refazer</span>
                            </button>
                          )}
                          <button 
                            onClick={() => handleShowInstructions(task)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                            title="Ver Instruções"
                          >
                            <Info size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-dashed border-gray-300 py-32 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <FileSpreadsheet className="text-blue-500 w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Plataforma Pronta</h2>
          <p className="text-gray-500 max-w-sm mb-8 px-6">
            Acesse como Administrador para carregar sua primeira planilha de atividades e gerenciar sua equipe.
          </p>
          
          <div className="flex flex-col items-center gap-4">
            {!isAdmin && !viewOnly && (
              <>
                <div id="googleSignInBtn" className="flex justify-center mb-2"></div>
                
                <div className="flex items-center gap-4 w-full max-w-xs">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-gray-400 text-xs font-medium uppercase tracking-widest">ou</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <button 
                  onClick={handleAdminFallback}
                  className="px-8 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-all flex items-center gap-2 shadow-lg"
                >
                  Logar como Administrador (Demo)
                </button>
                
                <p className="text-[10px] text-gray-400 max-w-[250px] italic">
                  * Utilize o modo Demo caso ocorra o erro 401 (invalid_client) ou o login do Google esteja bloqueado pelo seu navegador.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Observation Modal */}
      {activeObservation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${activeObservation.type === TaskStatus.COMPLETED ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              {activeObservation.type === TaskStatus.COMPLETED ? <CheckCircle size={28} /> : <Clock size={28} />}
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Detalhes da {activeObservation.type === TaskStatus.COMPLETED ? 'Conclusão' : 'Reprogramação'}
            </h3>
            <p className="text-gray-500 mb-6 text-sm">
              Adicione observações importantes sobre o andamento desta atividade.
            </p>
            
            <div className="relative mb-6">
              <textarea 
                className="w-full h-40 p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-gray-700 text-sm leading-relaxed"
                placeholder="Descreva o que aconteceu ou use o áudio..."
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <VoiceRecorder onTranscription={(t) => setObsText(prev => prev ? `${prev} ${t}` : t)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setActiveObservation(null); setObsText(''); }}
                className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={() => updateStatus(activeObservation.id, activeObservation.type, obsText)}
                className={`flex-1 py-4 text-white font-bold rounded-2xl transition-all shadow-lg ${activeObservation.type === TaskStatus.COMPLETED ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'}`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <Info size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Guia Inteligente</h3>
              </div>
              <button onClick={() => setShowInstructions(false)} className="text-gray-400 hover:text-gray-600 p-2">
                <RotateCcw size={20} />
              </button>
            </div>
            
            <div className="prose prose-sm text-gray-600 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100 whitespace-pre-wrap leading-relaxed shadow-inner">
              {instructionContent}
            </div>

            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-xl"
            >
              Confirmar Leitura
            </button>
          </div>
        </div>
      )}

      {/* Login Error Notification */}
      {loginError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-xl flex items-start gap-3 animate-in slide-in-from-right-4 duration-300">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-bold text-red-800">Problema no Acesso</p>
            <p className="text-xs text-red-600">{loginError}. Tente o Modo Demo.</p>
          </div>
          <button onClick={() => setLoginError(null)} className="text-red-400 hover:text-red-600 ml-4 font-bold">×</button>
        </div>
      )}
    </div>
  );
};

export default App;
