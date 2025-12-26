
import React, { useState, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, Package, Truck, MessageSquare, Send,
  Loader2, Activity, Scale, Zap, Mic, MicOff, Flame, 
  LayoutDashboard, Info, LogOut, ShieldCheck, User, 
  ArrowRight, CheckCircle2, Trophy, Globe
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { SALES_DATA, INVENTORY_DATA, SUPPLIER_DATA, LOGISTICS_DATA } from './constants';
import { getChainAnalysis, getSystemSummary, getSupplierComparison } from './services/geminiService';
import { Message, SalesData, InventoryData, LogisticsData } from './types';

type LogType = 'info' | 'warn' | 'error';
type ViewType = 'dashboard' | 'comparison' | 'about';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // --- APP STATE ---
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [sales, setSales] = useState<SalesData[]>(SALES_DATA);
  const [inventory, setInventory] = useState<InventoryData[]>(INVENTORY_DATA);
  const [logistics] = useState<LogisticsData[]>(LOGISTICS_DATA);
  const [activityLog, setActivityLog] = useState<{time: string, msg: string, type: LogType}[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- CHAT & VOICE STATE ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const voiceSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages, isTyping]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => simulateStep(), 15000);
    return () => clearInterval(interval);
  }, [sales, inventory, isLoggedIn]);

  const simulateStep = (incident?: string) => {
    const lastSale = sales[sales.length - 1].unitsSold;
    const newSaleAmount = incident ? lastSale * 2 : Math.floor(lastSale * (1 + (Math.random() * 0.05)));
    const newSalesEntry = { date: new Date().toISOString().split('T')[0], product: 'Shampoo', unitsSold: newSaleAmount };
    
    setSales(prev => [...prev.slice(1), newSalesEntry]);
    setInventory(prev => {
      const updated = [...prev];
      updated[0].currentStock = Math.max(0, updated[0].currentStock - Math.floor(newSaleAmount / 8));
      return updated;
    });

    const logTime = new Date().toLocaleTimeString();
    const logType: LogType = incident ? 'error' : (inventory[0].currentStock < inventory[0].safetyStock ? 'warn' : 'info');
    
    setActivityLog(prev => [
      { 
        time: logTime, 
        msg: incident ? `EMERGENCY: ${incident}` : `Market Check: Demand at ${newSaleAmount}`, 
        type: logType 
      }, 
      ...prev
    ].slice(0, 15));
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    const init = async () => {
      const res = await getSystemSummary(sales, inventory, SUPPLIER_DATA, logistics);
      if (res) setSummary(res);
      setLoading(false);
    };
    init();
  }, [isLoggedIn]);

  // --- HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setTimeout(() => {
      setIsLoggedIn(true);
      setLoginLoading(false);
    }, 1200);
  };

  const runComparison = async () => {
    setCurrentView('comparison');
    setComparing(true);
    const res = await getSupplierComparison(SUPPLIER_DATA, inventory[0].currentStock < 400);
    setComparison(res);
    setComparing(false);
  };

  const toggleVoiceMode = async () => {
    if (isVoiceActive) {
      voiceSessionRef.current?.close();
      setIsVoiceActive(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are ChainMind, an expert supply chain voice assistant. Speak naturally in Hinglish. Help the user manage inventory and logistics based on the current dashboard data.",
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
        },
        callbacks: {
          onopen: () => {
            setIsVoiceActive(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              session.sendRealtimeInput({ media: { data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), mimeType: 'audio/pcm;rate=16000' } });
            };
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (msg) => {
            const parts = msg.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              const audioData = parts[0]?.inlineData?.data;
              if (audioData) playAudio(audioData);
            }
          },
          onclose: () => setIsVoiceActive(false),
          onerror: () => setIsVoiceActive(false),
        }
      });
      voiceSessionRef.current = session;
    } catch (err) {
      console.error("Voice failed:", err);
      alert("Microphone access is required for Voice Mode.");
    }
  };

  const playAudio = async (base64: string) => {
    if (!audioContextRef.current) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    const aiResponse = await getChainAnalysis(input, sales, inventory, SUPPLIER_DATA, logistics);
    setMessages(prev => [...prev, { role: 'assistant', content: aiResponse || '' }]);
    setIsTyping(false);
  };

  // --- VIEWS ---
  if (!isLoggedIn) return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[150px] rounded-full"></div>
      
      <div className="w-full max-w-md z-10">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <Zap className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">ChainMind <span className="text-blue-500">Pro</span></h1>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Enterprise Login</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="text" 
                defaultValue="admin@chainmind.ai"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="Manager ID"
              />
            </div>
            <div>
              <input 
                type="password" 
                defaultValue="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-600"
                placeholder="Security Code"
              />
            </div>
            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group active:scale-95 shadow-lg shadow-blue-600/20"
            >
              {loginLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                <>Enter Neural Hub <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-white/5 flex justify-center gap-6">
            <ShieldCheck className="text-slate-500 w-5 h-5" />
            <Globe className="text-slate-500 w-5 h-5" />
            <Activity className="text-slate-500 w-5 h-5" />
          </div>
        </div>
        <p className="text-center mt-6 text-slate-500 text-[10px] uppercase font-black tracking-widest">
          Secured by Gemini Enterprise Protocol • v2.5.0
        </p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0a0c10] text-white">
      <div className="relative">
        <Loader2 className="w-20 h-20 animate-spin text-blue-500 opacity-20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
      </div>
      <h2 className="text-xl font-black tracking-[0.3em] uppercase mt-8 animate-pulse text-blue-400">Syncing Supply Chain Nodes</h2>
      <p className="text-slate-500 text-xs mt-2">Connecting to Mumbai_WH_01 through secure tunnel...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* --- SIDEBAR --- */}
      <aside className="w-20 lg:w-64 bg-[#0a0c10] border-r border-white/5 flex flex-col items-center lg:items-stretch transition-all duration-300 z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <h2 className="text-white font-black text-lg tracking-tighter hidden lg:block">ChainMind</h2>
        </div>

        <nav className="flex-1 mt-10 px-4 space-y-2">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            icon={<LayoutDashboard />} 
            label="Command Center" 
          />
          <NavItem 
            active={currentView === 'comparison'} 
            onClick={runComparison}
            icon={<Scale />} 
            label="Supplier Battle" 
          />
          <NavItem 
            active={currentView === 'about'} 
            onClick={() => setCurrentView('about')}
            icon={<Info />} 
            label="Core Tech" 
          />
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-white/5 p-4 rounded-2xl hidden lg:flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-white text-xs font-black truncate">Sameer_S</p>
              <p className="text-slate-500 text-[10px] font-bold">Manager</p>
            </div>
          </div>
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="w-full p-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl flex items-center justify-center lg:justify-start gap-3 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden lg:block font-bold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50">
        {currentView === 'dashboard' && (
          <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex -space-x-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></span>
                  </div>
                  <p className="text-slate-500 text-xs font-black uppercase tracking-widest">Real-time Neural Analysis Enabled</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => simulateStep("Critical Highway Blockage!")}
                  className="bg-white text-slate-900 border border-slate-200 px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm active:scale-95"
                >
                  <Flame className="w-4 h-4" /> Simulate Incident
                </button>
                <button 
                  onClick={toggleVoiceMode}
                  className={`px-8 py-3 rounded-2xl flex items-center gap-2 text-xs font-black transition-all shadow-xl shadow-blue-500/20 active:scale-95 ${isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {isVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isVoiceActive ? 'Listening...' : 'Voice Command'}
                </button>
              </div>
            </header>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Stock" value={inventory[0].currentStock} icon={<Package />} color="blue" subtitle="Mumbai Warehouse" alert={inventory[0].currentStock < 400} />
              <StatCard title="Velocity" value={`${sales[sales.length - 1].unitsSold}/d`} icon={<TrendingUp />} color="emerald" subtitle="+12% from Yday" />
              <StatCard title="Risk Index" value={inventory[0].currentStock < 400 ? "CRITICAL" : "STABLE"} icon={<AlertTriangle />} color={inventory[0].currentStock < 400 ? "red" : "amber"} subtitle="AI Confidence 98%" />
              <StatCard title="Auto-Ops" value={summary?.procurement?.units || "Pending"} icon={<Truck />} color="purple" subtitle={`Target: ${summary?.procurement?.supplier || '...'}`} />
            </div>

            {/* ANALYTICS ROW */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-8">
                {/* CHART */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8">
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <TrendingUp className="w-3 h-3" /> Predictive Curve
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-[0.2em] text-xs mb-8">
                    <Activity className="w-5 h-5 text-blue-500" />
                    Demand Velocity Pulse
                  </h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sales}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" hide />
                        <YAxis hide />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="unitsSold" stroke="#3b82f6" strokeWidth={6} fillOpacity={1} fill="url(#colorSales)" animationDuration={2000} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* LOGISTICS MINI PANEL */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-[0.2em] text-xs mb-6">
                    <Truck className="w-5 h-5 text-purple-500" />
                    Active Logistics Hub
                  </h3>
                  <div className="space-y-4">
                    {logistics.map((l, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-3xl group hover:bg-blue-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-600 group-hover:text-blue-600">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{l.route}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{l.distanceKm} KM • {l.riskFactors} Risk</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900 text-sm">{l.avgDeliveryTimeDays} Day</p>
                          <p className="text-[10px] text-green-500 font-black uppercase">On Time</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* LOG PANEL */}
              <div className="space-y-8">
                <div className="bg-[#0a0c10] p-8 rounded-[2.5rem] text-white shadow-2xl h-full min-h-[500px] flex flex-col border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full"></div>
                  <h3 className="font-black text-[10px] uppercase tracking-[0.3em] mb-8 text-blue-500 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    Neural Log Matrix
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
                    {activityLog.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600 italic text-xs">Waiting for data stream...</div>
                    ) : activityLog.map((log, i) => (
                      <div key={i} className="group animate-in slide-in-from-right duration-500">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[9px] text-slate-600 font-black tracking-widest">{log.time}</span>
                          <span className={`text-[8px] font-black uppercase tracking-widest ${log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-yellow-500' : 'text-blue-500'}`}>{log.type}</span>
                        </div>
                        <p className={`text-[11px] leading-relaxed ${log.type === 'error' ? 'text-red-400 font-bold' : log.type === 'warn' ? 'text-yellow-200' : 'text-slate-300'}`}>
                          {log.msg}
                        </p>
                        <div className="h-[1px] w-0 group-hover:w-full bg-white/5 transition-all mt-3"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'comparison' && (
          <div className="p-6 lg:p-10 animate-in zoom-in-95 duration-500">
             <div className="max-w-6xl mx-auto space-y-10">
                <header className="text-center space-y-4">
                  <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Supplier Battle Matrix</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">AI-Driven Strategic Benchmarking</p>
                </header>

                {comparing ? (
                  <div className="py-40 flex flex-col items-center justify-center space-y-6">
                    <Loader2 className="w-16 h-16 animate-spin text-blue-600" />
                    <p className="text-slate-400 font-black uppercase tracking-widest animate-pulse">Running Neural Simulation...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {comparison?.comparison?.map((s:any, i:number) => (
                      <div key={i} className={`relative p-10 rounded-[3rem] border-4 transition-all hover:scale-[1.02] ${s.rank === 1 ? 'bg-blue-600 border-blue-400 text-white shadow-2xl shadow-blue-500/30' : 'bg-white border-slate-100 text-slate-900 shadow-xl'}`}>
                        {s.rank === 1 && (
                          <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 font-black px-6 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <Trophy className="w-4 h-4" /> AI CHAMPION
                          </div>
                        )}
                        <h3 className="text-3xl font-black mb-1">{s.name}</h3>
                        <p className={`text-[11px] font-black uppercase tracking-widest mb-8 ${s.rank === 1 ? 'text-blue-100' : 'text-slate-400'}`}>Neural Score: {s.score}/100</p>
                        
                        <div className="space-y-6">
                          <MetricBar label="Lead Time Efficiency" value={95 - (i*10)} active={s.rank === 1} />
                          <MetricBar label="Cost Optimization" value={s.score - 5} active={s.rank === 1} />
                          <MetricBar label="Reliability Index" value={88 + (s.rank === 1 ? 5 : -5)} active={s.rank === 1} />
                        </div>

                        <div className="mt-10 space-y-4">
                          <p className={`text-xs font-black uppercase tracking-widest ${s.rank === 1 ? 'text-blue-200' : 'text-slate-400'}`}>AI Analysis</p>
                          <div className="flex flex-wrap gap-2">
                            {s.pros.map((p:string, j:number) => (
                              <span key={j} className={`px-4 py-2 rounded-2xl text-[10px] font-black flex items-center gap-2 ${s.rank === 1 ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                <CheckCircle2 className="w-3 h-3" /> {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-slate-900 p-10 rounded-[3rem] text-white">
                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shrink-0">
                      <Zap className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black mb-2 tracking-tight">AI Strategy Insight</h4>
                      <p className="text-slate-400 text-sm leading-relaxed">{comparison?.logic || "ChainMind recommends Apex for large batches due to lead time consistency, while Local Fresh is prioritized for urgent safety stock buffers."}</p>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        )}

        {currentView === 'about' && (
          <div className="p-6 lg:p-20 max-w-4xl mx-auto animate-in slide-in-from-bottom duration-700">
            <div className="text-center mb-16">
              <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-blue-500/40">
                <Zap className="w-12 h-12" />
              </div>
              <h2 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">ChainMind Core</h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-sm">Next-Gen Supply Intelligence</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <AboutCard title="Neural Forecasting" desc="Proprietary demand sensing algorithms that analyze market velocity in milliseconds." icon={<TrendingUp />} />
              <AboutCard title="Autonomous Procurement" desc="Self-healing supply chain protocols that trigger orders before stockouts occur." icon={<Zap />} />
              <AboutCard title="Voice Interface" desc="Direct low-latency communication with the Gemini 2.5 multimodal backbone." icon={<Mic />} />
              <AboutCard title="Risk Shield" desc="Continuous monitoring of global logistics events and warehouse telemetry." icon={<ShieldCheck />} />
            </div>

            <div className="mt-20 p-10 bg-white rounded-[3rem] border border-slate-100 text-center space-y-4">
              <p className="text-slate-400 font-black uppercase tracking-widest text-xs">A Product of</p>
              <h4 className="text-3xl font-black text-slate-900 tracking-tighter">ChainMind Systems Inc.</h4>
              <p className="text-slate-500 text-sm max-w-md mx-auto italic">"Building the nervous system for the world's most efficient supply chains."</p>
            </div>
          </div>
        )}
      </main>

      {/* --- AI CHAT SIDEBAR --- */}
      <div className="w-full lg:w-[450px] bg-white border-l border-slate-100 flex flex-col shadow-[0_-20px_100px_rgba(0,0,0,0.05)] relative z-10">
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0a0c10] rounded-2xl flex items-center justify-center text-white shadow-xl">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight">ChainMind GPT</h3>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Enterprise Strategist</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-8">
              <div className="w-20 h-20 bg-slate-50 rounded-full mx-auto flex items-center justify-center text-slate-300">
                <Activity className="w-10 h-10" />
              </div>
              <p className="text-sm text-slate-400 italic font-medium">"System ready. Ask me to compare suppliers, check routes, or forecast demand."</p>
              <div className="flex flex-col gap-3">
                <QuickAction label="Show nearby warehouses" onClick={() => setInput("Nearby warehouses dikhao map pe")} />
                <QuickAction label="Best supplier for urgent order?" onClick={() => setInput("Urgent order ke liye best supplier kaunsa hai?")} />
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[90%] p-5 rounded-[2rem] text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                <div className="whitespace-pre-wrap font-medium">{m.content}</div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="bg-slate-50 p-5 rounded-[2rem] w-24 flex gap-1.5 justify-center">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-8 border-t border-slate-100 bg-white">
          <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Talk to ChainMind..."
              className="w-full py-5 pl-8 pr-16 bg-slate-50 border-0 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-400"
            />
            <button 
              onClick={handleSend} 
              className="absolute right-3 top-3 p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all active:scale-90 shadow-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- HELPER COMPONENTS ---

const NavItem = ({ active, icon, label, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
  >
    <div className={`${active ? 'text-white' : 'group-hover:text-white'} transition-colors`}>{React.cloneElement(icon, { size: 22 })}</div>
    <span className="hidden lg:block font-black text-xs uppercase tracking-widest">{label}</span>
  </button>
);

const StatCard = ({ title, value, unit, icon, subtitle, color, alert }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100 ring-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100 ring-emerald-50',
    purple: 'text-purple-600 bg-purple-50 border-purple-100 ring-purple-50',
    amber: 'text-amber-600 bg-amber-50 border-amber-100 ring-amber-50',
    red: 'text-red-600 bg-red-50 border-red-100 ring-red-50 shadow-red-100 shadow-xl'
  };

  return (
    <div className={`p-8 bg-white rounded-[2.5rem] border-2 transition-all hover:-translate-y-1 shadow-xl shadow-slate-200/50 ${alert ? colors.red : 'border-slate-50'}`}>
      <div className="flex justify-between items-start mb-6">
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{title}</span>
        <div className={`p-3 rounded-2xl ${colors[color]}`}>{icon}</div>
      </div>
      <div className="mb-6">
        <span className={`text-4xl font-black tracking-tighter ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
      </div>
      <div className="pt-5 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{subtitle}</span>
        {alert && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
      </div>
    </div>
  );
};

const MetricBar = ({ label, value, active }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
      <span className={active ? 'text-blue-100' : 'text-slate-400'}>{label}</span>
      <span className={active ? 'text-white' : 'text-slate-900'}>{value}%</span>
    </div>
    <div className={`h-2.5 rounded-full w-full ${active ? 'bg-blue-800' : 'bg-slate-100'}`}>
      <div 
        className={`h-full rounded-full transition-all duration-1000 ${active ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-slate-900'}`} 
        style={{ width: `${value}%` }} 
      />
    </div>
  </div>
);

const AboutCard = ({ title, desc, icon }: any) => (
  <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 group hover:border-blue-500 transition-colors">
    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-800 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
      {React.cloneElement(icon, { size: 28 })}
    </div>
    <h3 className="text-xl font-black mb-2 tracking-tight">{title}</h3>
    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
  </div>
);

const QuickAction = ({ label, onClick }: any) => (
  <button 
    onClick={onClick} 
    className="text-[10px] p-4 bg-white border border-slate-100 rounded-2xl font-black uppercase tracking-widest text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all text-left shadow-sm active:scale-95"
  >
    {label}
  </button>
);

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{payload[0].payload.date}</p>
        <p className="text-lg font-black">{payload[0].value} Units</p>
      </div>
    );
  }
  return null;
};

export default App;
