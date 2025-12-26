
import React, { useState, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  AlertTriangle, TrendingUp, Package, Truck, MessageSquare, Send,
  Loader2, Activity, Scale, Zap, Mic, MicOff, Flame
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import { SALES_DATA, INVENTORY_DATA, SUPPLIER_DATA, LOGISTICS_DATA } from './constants';
import { getChainAnalysis, getSystemSummary, getSupplierComparison } from './services/geminiService';
import { Message, SalesData, InventoryData, LogisticsData } from './types';

type LogType = 'info' | 'warn' | 'error';

const App: React.FC = () => {
  const [sales, setSales] = useState<SalesData[]>(SALES_DATA);
  const [inventory, setInventory] = useState<InventoryData[]>(INVENTORY_DATA);
  const [logistics] = useState<LogisticsData[]>(LOGISTICS_DATA);
  const [activityLog, setActivityLog] = useState<{time: string, msg: string, type: LogType}[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [loading, setLoading] = useState(true);

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
    const interval = setInterval(() => simulateStep(), 15000);
    return () => clearInterval(interval);
  }, [sales, inventory]);

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
    ].slice(0, 8));
  };

  useEffect(() => {
    const init = async () => {
      const res = await getSystemSummary(sales, inventory, SUPPLIER_DATA, logistics);
      if (res) setSummary(res);
      setLoading(false);
    };
    init();
  }, []);

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

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
      <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
      <h2 className="text-xl font-bold tracking-widest uppercase">ChainMind Core Initializing</h2>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-8 space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">ChainMind <span className="text-blue-600">Pro</span></h1>
            <p className="text-slate-500 font-bold flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Neural Supply Chain Network • Mumbai Node
            </p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => simulateStep("Major Warehouse Fire Alert!")}
              className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-black hover:bg-red-600 hover:text-white transition-all shadow-sm"
            >
              <Flame className="w-4 h-4" /> Simulate Incident
            </button>
            <button 
              onClick={toggleVoiceMode}
              className={`px-6 py-2 rounded-2xl flex items-center gap-2 text-xs font-black transition-all shadow-lg ${isVoiceActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
            >
              {isVoiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isVoiceActive ? 'Stop Listening' : 'Voice Mode'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card title="Inventory" value={inventory[0].currentStock} unit="Units" icon={<Package />} footer="Mumbai WH" highlight={inventory[0].currentStock < 400} />
          <Card title="Daily Demand" value={sales[sales.length - 1].unitsSold} unit="Avg" icon={<TrendingUp />} footer="Trending Up" />
          <Card title="Risk Level" value={inventory[0].currentStock < 400 ? "CRITICAL" : "STABLE"} unit="" icon={<AlertTriangle />} footer="Stockout in 3 days" highlight={inventory[0].currentStock < 400} />
          <Card title="Auto-Procure" value={summary?.procurement?.units || 0} unit="Units" icon={<Truck />} footer={summary?.procurement?.supplier || "Apex"} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-sm">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Demand Velocity Analytics
                </h3>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sales}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                    <Line type="monotone" dataKey="unitsSold" stroke="#2563eb" strokeWidth={5} dot={false} animationDuration={2000} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-sm">
                    <Scale className="w-5 h-5 text-purple-500" />
                    Supplier Decision Matrix
                  </h3>
                  <button onClick={async () => {
                    setComparing(true); setShowComparison(true);
                    const res = await getSupplierComparison(SUPPLIER_DATA, inventory[0].currentStock < 400);
                    setComparison(res); setComparing(false);
                  }} className="text-xs font-black text-blue-600 underline">Refresh AI Benchmarking</button>
               </div>
               {showComparison ? (
                 comparing ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div> :
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {comparison?.comparison?.map((s:any, i:number) => (
                     <div key={i} className={`p-6 rounded-3xl border-2 ${s.rank === 1 ? 'border-blue-500 bg-blue-50/20' : 'border-slate-50 bg-white'}`}>
                       <p className="font-black text-slate-900 mb-2">{s.name}</p>
                       <p className="text-[10px] uppercase text-slate-400 font-bold mb-3">AI Rating: {s.score}/100</p>
                       <div className="flex gap-2">
                         {s.pros.slice(0, 2).map((p:string, j:number) => <span key={j} className="text-[9px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">{p}</span>)}
                       </div>
                     </div>
                   ))}
                 </div>
               ) : <div className="py-12 text-center text-slate-300 italic text-sm">Run AI Comparison to see optimal supplier selection...</div>}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-950 p-6 rounded-[2rem] text-white shadow-2xl h-[400px] flex flex-col">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] mb-4 text-blue-400">Live Operation Log</h3>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                {activityLog.map((log, i) => (
                  <div key={i} className={`flex gap-3 text-[11px] animate-in slide-in-from-right duration-500`}>
                    <span className="text-slate-600 font-mono shrink-0">{log.time}</span>
                    <p className={`${log.type === 'error' ? 'text-red-400 font-bold' : log.type === 'warn' ? 'text-yellow-200' : 'text-slate-300'}`}>
                      {log.msg}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[450px] bg-white border-l border-slate-100 flex flex-col shadow-2xl relative">
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-lg leading-tight tracking-tight">ChainMind GPT</h3>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Enterprise Strategist</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-8">
              <p className="text-sm text-slate-400 italic">"How can I optimize your supply chain today?"</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => setInput("Show me routes on map")} className="text-xs p-4 border rounded-2xl font-bold hover:bg-blue-50 text-left transition-all">🗺️ "Show me nearby warehouses on map"</button>
                <button onClick={() => setInput("Simulate urgent order")} className="text-xs p-4 border rounded-2xl font-bold hover:bg-blue-50 text-left transition-all">🚨 "Urgent order ke liye best supplier kaunsa hai?"</button>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {isTyping && <div className="bg-slate-50 p-4 rounded-3xl w-20 flex gap-1 justify-center"><div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce"></div><div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-100"></div><div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-200"></div></div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-8 border-t border-slate-100">
          <div className="relative">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="w-full py-5 pl-8 pr-16 bg-slate-50 border-0 rounded-[2rem] text-sm font-bold focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400"
            />
            <button onClick={handleSend} className="absolute right-3 top-3 p-3 bg-slate-900 text-white rounded-2xl hover:bg-blue-600 transition-all active:scale-90"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value, unit, icon, footer, highlight }: any) => (
  <div className={`p-6 bg-white rounded-[2rem] border-2 transition-all ${highlight ? 'border-red-500 ring-4 ring-red-50 shadow-xl shadow-red-100' : 'border-slate-50 shadow-lg shadow-slate-100'}`}>
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{title}</span>
      <div className={`p-2 rounded-xl ${highlight ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-blue-600'}`}>{icon}</div>
    </div>
    <div className="flex items-baseline gap-1 mb-4">
      <span className={`text-4xl font-black ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
      <span className="text-[10px] font-black text-slate-400 uppercase">{unit}</span>
    </div>
    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
      <span className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-red-500' : 'text-slate-400'}`}>{footer}</span>
      {highlight && <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>}
    </div>
  </div>
);

export default App;
