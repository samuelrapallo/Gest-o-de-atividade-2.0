
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
  LayoutDashboard,
  Database,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Task, TaskStatus, GoogleUser } from './types';
import { DashboardCharts } from './components/DashboardCharts';
import { VoiceRecorder } from './components/VoiceRecorder';
import { getSmartInstructions } from './services/geminiService';

declare const google: any;

const GOOGLE_CLIENT_ID = "713437593922-a8k77eaj3n20p38m7o7k48v23c7f9j9f.apps.googleusercontent.com";

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [activeObservation, setActiveObservation] = useState<{ id: string, type: TaskStatus } | null>(null);
  const [obsText, setObsText] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionContent, setInstructionContent] = useState('');
  const [feedback, setFeedback] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Efeito para carregar dados do LocalStorage ao iniciar
  useEffect(() => {
    const savedTasks = localStorage.getItem('executive_tasks');
    const savedUser = localStorage.getItem('executive_user');
    
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        if (Array.isArray(parsed)) setTasks(parsed);
      } catch (e) {
        console.error("Erro ao carregar tarefas salvas", e);
      }
    }
    
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Erro ao carregar usuário salvo", e);
      }
    }
    
    if (window.location.hash.includes('share=true')) {
      setViewOnly(true);
    }
  }, []);

  // Sincronização automática com LocalStorage
  useEffect(() => {
    localStorage.setItem('executive_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('executive_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('executive_user');
    }
  }, [user]);

  // Feedback automático (auto-hide)
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    const initGsi = () => {
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res: any) => {
            const payload = JSON.parse(atob(res.credential.split('.')[1]));
            setUser({
              name: payload.name,
              email: payload.email,
              picture: payload.picture,
              sub: payload.sub
            });
          },
          ux_mode: 'popup',
        });
        const btn = document.getElementById("googleSignInBtn");
        if (btn && !user && !viewOnly) {
          google.accounts.id.renderButton(btn, { theme: "outline", size: "large", width: 250 });
        }
      } else {
        setTimeout(initGsi, 500);
      }
    };
    initGsi();
  }, [user, viewOnly]);

  const loginAsAdmin = () => {
    setUser({
      name: "Administrador Local",
      email: "admin@gestao.com",
      picture: "https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff",
      sub: "local-admin-id"
    });
    setFeedback({ msg: "Logado como administrador", type: 'success' });
  };

  const handleLogout = () => {
    setUser(null);
    setFeedback({ msg: "Sessão encerrada", type: 'success' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const findCol = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
            if (found) return row[found];
          }
          return null;
        };

        const mappedTasks: Task[] = data.map((row, idx) => ({
          id: Math.random().toString(36).substr(2, 9),
          atividade: findCol(row, ['atividades', 'atividade', 'activity', 'task']) || 'N/A',
          ordem: String(findCol(row, ['ordem', 'número da ordem', 'order', 'id', 'número']) || idx + 1),
          data: findCol(row, ['data', 'dados', 'date', 'day']) || new Date().toLocaleDateString(),
          executante: findCol(row, ['executante', 'nome do executante', 'executor', 'responsável']) || 'Não atribuído',
          status: TaskStatus.PENDING,
          observacoes: '',
          updatedAt: Date.now()
        }));

        if (mappedTasks.length > 0) {
          setTasks(mappedTasks);
          setFeedback({ msg: "Planilha carregada com sucesso!", type: 'success' });
        } else {
          setFeedback({ msg: "Nenhum dado encontrado na planilha.", type: 'error' });
        }
      } catch (err) {
        setFeedback({ msg: "Erro ao processar arquivo Excel.", type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const loadSampleData = () => {
    const samples: Task[] = [
      { id: 's1', atividade: 'Manutenção Preventiva Ar-Condicionado', ordem: '001', data: '24/05/2024', executante: 'Ricardo Nunes', status: TaskStatus.PENDING, observacoes: '', updatedAt: Date.now() },
      { id: 's2', atividade: 'Relatório Mensal de Custos', ordem: '002', data: '24/05/2024', executante: 'Ana Luiza', status: TaskStatus.COMPLETED, observacoes: 'Finalizado antes do prazo', updatedAt: Date.now() },
      { id: 's3', atividade: 'Reunião de Alinhamento de Projetos', ordem: '003', data: '25/05/2024', executante: 'Equipe Alpha', status: TaskStatus.RESCHEDULED, observacoes: 'Aguardando confirmação da diretoria', updatedAt: Date.now() },
    ];
    setTasks(samples);
    setFeedback({ msg: "Dados de exemplo carregados.", type: 'success' });
  };

  // FUNÇÃO CORRIGIDA: Limpa o estado e força atualização do LocalStorage
  const clearData = () => {
    const confirmacao = window.confirm('TEM CERTEZA? Isso removerá permanentEMENTE todos os dados desta planilha do sistema.');
    if (confirmacao) {
      setTasks([]);
      localStorage.setItem('executive_tasks', '[]');
      setFeedback({ msg: "Todos os dados foram apagados.", type: 'success' });
    }
  };

  const updateStatus = (id: string, status: TaskStatus, obs: string = '') => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status, observacoes: obs || t.observacoes, updatedAt: Date.now() } : t
    ));
    setActiveObservation(null);
    setObsText('');
    setFeedback({ msg: `Status atualizado para ${status}`, type: 'success' });
  };

  const undoStatus = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, status: TaskStatus.PENDING, updatedAt: Date.now() } : t
    ));
    setFeedback({ msg: "Atividade retornada para Pendente", type: 'success' });
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
    navigator.clipboard.writeText(`${baseUrl}#share=true`);
    setFeedback({ msg: "Link de visualização copiado!", type: 'success' });
  };

  const handleShowInstructions = async (task?: Task) => {
    setInstructionContent('Consultando inteligência artificial...');
    setShowInstructions(true);
    const context = task ? `Tarefa: ${task.atividade} para ${task.executante}` : 'Sistema de Gestão Executiva';
    const msg = await getSmartInstructions(context);
    setInstructionContent(msg);
  };

  const isAdmin = !!user;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6">
      
      {/* HEADER FIXO */}
      <header className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
            <LayoutDashboard size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-none">Gestor Executivo</h1>
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mt-1">Daily Operations Hub</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {isAdmin ? (
            <>
              <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-full border border-gray-200 pr-4">
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                <span className="text-xs font-bold text-gray-600 truncate max-w-[120px]">{user.name}</span>
                <button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors" title="Sair">
                  <LogOut size={16} />
                </button>
              </div>
              
              <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md cursor-pointer text-xs font-black">
                <Upload size={18} /> CARREGAR
                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              </label>

              <button 
                onClick={clearData} 
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-md text-xs font-black"
              >
                <Trash2 size={18} /> APAGAR TUDO
              </button>
            </>
          ) : !viewOnly && (
            <button onClick={loginAsAdmin} className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black hover:bg-black transition-all shadow-xl text-xs flex items-center gap-2">
              <LogIn size={18} /> ACESSO ADMINISTRATIVO
            </button>
          )}

          <button onClick={exportReport} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md text-xs font-black">
            <Download size={18} /> RELATÓRIO
          </button>
        </div>
      </header>

      {/* AMBIENTE DASHBOARD */}
      {tasks.length > 0 ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          <DashboardCharts tasks={tasks} />

          {/* BARRA DE BUSCA E SHARE */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <Search className="text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Filtre por atividade, executante ou código da ordem..."
                className="w-full bg-transparent border-none focus:ring-0 text-gray-700 text-sm font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isAdmin && (
              <button 
                onClick={generateShareLink} 
                className="px-6 py-4 bg-white text-indigo-600 rounded-2xl shadow-sm border border-indigo-50 hover:bg-indigo-50 transition-all font-black text-xs flex items-center gap-2"
              >
                <Share2 size={18} /> COMPARTILHAR DASHBOARD
              </button>
            )}
          </div>

          {/* LISTA DE ATIVIDADES */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ordem</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Atividade Detalhada</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Responsável</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Data</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Controle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-8 py-5 text-sm font-black text-blue-600">#{task.ordem}</td>
                      <td className="px-8 py-5">
                        <div className="max-w-md">
                          <p className="text-sm font-bold text-gray-800">{task.atividade}</p>
                          {task.observacoes && (
                            <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border-l-4 border-amber-400">
                              <p className="text-[11px] text-amber-800 font-medium italic leading-relaxed">
                                {task.observacoes}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-black text-gray-400">
                            {task.executante.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-600">{task.executante}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-xs text-gray-400 text-center font-bold tracking-tight">{task.data}</td>
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                          task.status === TaskStatus.RESCHEDULED ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-50 text-blue-500'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {task.status === TaskStatus.PENDING ? (
                            <>
                              <button 
                                onClick={() => setActiveObservation({ id: task.id, type: TaskStatus.COMPLETED })}
                                className="p-2.5 text-green-600 hover:bg-green-50 rounded-xl transition-all"
                                title="Concluir"
                              >
                                <CheckCircle size={20} />
                              </button>
                              <button 
                                onClick={() => setActiveObservation({ id: task.id, type: TaskStatus.RESCHEDULED })}
                                className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                title="Reprogramar"
                              >
                                <Clock size={20} />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => undoStatus(task.id)}
                              className="px-4 py-2 text-[10px] font-black text-gray-400 hover:text-blue-600 flex items-center gap-1.5 transition-all"
                            >
                              <RotateCcw size={14} /> REFAZER
                            </button>
                          )}
                          <button 
                            onClick={() => handleShowInstructions(task)} 
                            className="p-2.5 text-blue-400 hover:bg-blue-50 rounded-xl transition-all"
                            title="Instruções"
                          >
                            <Info size={20} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTasks.length === 0 && (
              <div className="py-20 text-center text-gray-400 flex flex-col items-center gap-2">
                <Search size={40} className="opacity-20" />
                <p className="font-bold text-sm">Nenhuma atividade encontrada com estes filtros.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ESTADO VAZIO / BEM-VINDO */
        <div className="flex-1 bg-white rounded-[40px] shadow-2xl shadow-blue-50/50 border-2 border-dashed border-blue-100 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in-95 duration-700">
          <div className="w-32 h-32 bg-blue-50 rounded-[40px] flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-10 animate-pulse"></div>
            <Database size={60} className="text-blue-600 relative z-10" />
          </div>
          
          <h2 className="text-4xl font-black text-gray-900 mb-4">Gestão Estratégica</h2>
          <p className="text-gray-500 max-w-lg mb-12 text-lg leading-relaxed">
            Bem-vindo ao centro de operações executivas. Carregue sua planilha de atividades diárias ou explore os recursos com nossos dados de demonstração.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
            {isAdmin ? (
              <>
                <label className="group flex flex-col items-center gap-4 p-8 bg-blue-600 text-white rounded-[32px] hover:bg-blue-700 transition-all cursor-pointer shadow-xl shadow-blue-100">
                  <Upload size={32} />
                  <span className="font-black text-sm">IMPORTAR EXCEL</span>
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
                </label>
                <button 
                  onClick={loadSampleData}
                  className="group flex flex-col items-center gap-4 p-8 bg-white text-blue-600 border-4 border-blue-50 rounded-[32px] hover:bg-blue-50 transition-all shadow-xl shadow-gray-50"
                >
                  <LayoutDashboard size={32} />
                  <span className="font-black text-sm">DADOS DEMO</span>
                </button>
              </>
            ) : (
              <div className="col-span-full flex flex-col items-center gap-6">
                <button 
                  onClick={loginAsAdmin}
                  className="w-full max-w-xs py-5 bg-gray-900 text-white rounded-[24px] font-black hover:bg-black transition-all shadow-2xl flex items-center justify-center gap-3"
                >
                  <LogIn size={24} /> ACESSAR AGORA
                </button>
                <div id="googleSignInBtn"></div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 max-w-xs">
                  <p className="text-[11px] text-amber-700 leading-normal flex gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Dica: Use <b>Acessar Agora</b> para ignorar configurações de OAuth/Google se estiver em modo teste.</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE OBSERVAÇÃO / MICROFONE */}
      {activeObservation && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 border border-gray-100">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-inner ${
              activeObservation.type === TaskStatus.COMPLETED ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {activeObservation.type === TaskStatus.COMPLETED ? <CheckCircle size={32} /> : <Clock size={32} />}
            </div>

            <h3 className="text-2xl font-black text-gray-900 mb-2">Relato de Atividade</h3>
            <p className="text-sm text-gray-500 mb-8 font-medium">Descreva o ocorrido ou utilize o botão de áudio para transcrever automaticamente.</p>
            
            <div className="relative mb-8">
              <textarea 
                className="w-full h-40 p-5 bg-gray-50 border border-gray-200 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none text-sm font-medium transition-all resize-none"
                placeholder="Ex: Tudo conforme o esperado..."
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
              />
              <div className="absolute bottom-4 right-4">
                <VoiceRecorder onTranscription={(t) => setObsText(prev => prev ? `${prev} ${t}` : t)} />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setActiveObservation(null); setObsText(''); }}
                className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all text-xs"
              >
                DESCARTAR
              </button>
              <button 
                onClick={() => updateStatus(activeObservation.id, activeObservation.type, obsText)}
                className={`flex-1 py-4 text-white font-black rounded-2xl shadow-xl transition-all text-xs ${
                  activeObservation.type === TaskStatus.COMPLETED ? 'bg-green-600 hover:bg-green-700 shadow-green-100' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
                }`}
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTRUÇÕES IA */}
      {showInstructions && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-10 border border-gray-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <Info size={28} />
              </div>
              <h3 className="text-2xl font-black text-gray-900">Orientações Smart</h3>
            </div>
            
            <div className="bg-indigo-50/50 p-8 rounded-[24px] border border-indigo-100 text-sm text-indigo-900 leading-relaxed font-medium italic mb-10 shadow-inner max-h-60 overflow-y-auto">
              {instructionContent}
            </div>

            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full py-5 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-2xl shadow-gray-200"
            >
              CONCLUIR CONSULTA
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO DE FEEDBACK */}
      {feedback && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl text-white font-bold text-sm animate-in slide-in-from-bottom-8 duration-300 z-50 flex items-center gap-2 ${
          feedback.type === 'success' ? 'bg-green-600 shadow-green-200' : 'bg-red-600 shadow-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
          {feedback.msg}
        </div>
      )}

    </div>
  );
};

export default App;
