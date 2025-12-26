
import React, { useState, useEffect, useRef } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  AlertTriangle, 
  TrendingUp, 
  Package, 
  Truck, 
  MessageSquare, 
  Send,
  Loader2,
  ChevronRight,
  ShieldCheck,
  PackageCheck,
  Activity,
  History,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Timer,
  Scale,
  Award,
  Zap
} from 'lucide-react';
import { SALES_DATA, INVENTORY_DATA, SUPPLIER_DATA, LOGISTICS_DATA } from './constants';
import { getChainAnalysis, getSystemSummary, getSupplierComparison } from './services/geminiService';
import { Message, SalesData, InventoryData, LogisticsData, SupplierData } from './types';

const App: React.FC = () => {
  // Live State
  const [sales, setSales] = useState<SalesData[]>(SALES_DATA);
  const [inventory, setInventory] = useState<InventoryData[]>(INVENTORY_DATA);
  const [logistics, setLogistics] = useState<LogisticsData[]>(LOGISTICS_DATA);
  const [activityLog, setActivityLog] = useState<{time: string, msg: string, type: 'info' | 'warn'}[]>([]);
  
  const [summary, setSummary] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [comparing, setComparing] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Simulation Tick
  useEffect(() => {
    const interval = setInterval(() => {
      simulateStep();
    }, 12000);
    return () => clearInterval(interval);
  }, [sales, inventory]);

  const simulateStep = () => {
    const lastSale = sales[sales.length - 1].unitsSold;
    const newSaleAmount = Math.floor(lastSale * (1 + (Math.random() * 0.05)));
    
    const today = new Date();
    const newDate = today.toISOString().split('T')[0];
    const newSalesEntry = { date: newDate, product: 'Shampoo', unitsSold: newSaleAmount };
    
    setSales(prev => [...prev.slice(1), newSalesEntry]);

    setInventory(prev => {
      const updated = [...prev];
      updated[0].currentStock = Math.max(0, updated[0].currentStock - Math.floor(newSaleAmount / 10));
      return updated;
    });

    if (Math.random() > 0.7) {
      setLogistics(prev => {
        const updated = [...prev];
        const randomIndex = Math.floor(Math.random() * updated.length);
        const risks: ('Traffic' | 'Weather' | 'None')[] = ['Traffic', 'Weather', 'None'];
        updated[randomIndex].riskFactors = risks[Math.floor(Math.random() * risks.length)];
        return updated;
      });
    }

    const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isRisk = inventory[0].currentStock < inventory[0].safetyStock;
    setActivityLog(prev => [
      { 
        time: logTime, 
        msg: `Market Check: ${newSaleAmount} units demanded. Stock: ${inventory[0].currentStock}`, 
        type: isRisk ? 'warn' : 'info' 
      }, 
      ...prev
    ].slice(0, 5));
  };

  // Initial Summary
  useEffect(() => {
    const fetchSummary = async () => {
      const res = await getSystemSummary(sales, inventory, SUPPLIER_DATA, logistics);
      if (res) setSummary(res);
      setLoading(false);
    };

    if (loading || (inventory[0].currentStock < inventory[0].safetyStock && summary?.risk?.level !== 'High')) {
      fetchSummary();
    }
  }, [loading, inventory]);

  const handleCompareSuppliers = async () => {
    setComparing(true);
    setShowComparison(true);
    const isUrgent = inventory[0].currentStock < inventory[0].safetyStock;
    const res = await getSupplierComparison(SUPPLIER_DATA, isUrgent);
    if (res) setComparison(res);
    setComparing(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const aiResponse = await getChainAnalysis(input, sales, inventory, SUPPLIER_DATA, logistics);
    const assistantMsg: Message = { role: 'assistant', content: aiResponse || 'No response' };
    setMessages(prev => [...prev, assistantMsg]);
    setIsTyping(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        <h2 className="text-xl font-medium tracking-tight">ChainMind AI System Check...</h2>
        <p className="text-slate-400">Loading supply chain intelligence...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar / Left Content - Dashboard */}
      <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">ChainMind <span className="text-blue-600 italic">AI</span></h1>
            <p className="text-slate-500 flex items-center gap-2 font-medium">
              Enterprise Dashboard • 
              <span className="flex items-center gap-1.5 text-green-600 font-bold">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                LIVE SIMULATION
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Decision Engine: Stable</span>
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            title="Current Stock" 
            value={inventory[0].currentStock} 
            unit="Units"
            icon={<Package className="text-blue-500" />}
            footer="Mumbai Central"
            highlight={inventory[0].currentStock < inventory[0].safetyStock}
          />
          <Card 
            title="Market Demand" 
            value={sales[sales.length - 1].unitsSold} 
            unit="Units/Day"
            icon={<TrendingUp className="text-emerald-500" />}
            footer="Seasonal Peak"
          />
          <Card 
            title="Stockout Risk" 
            value={inventory[0].currentStock < inventory[0].safetyStock ? "CRITICAL" : (summary?.risk?.level || "Calculating")} 
            unit=""
            icon={<AlertTriangle className={inventory[0].currentStock < inventory[0].safetyStock ? 'text-red-500 animate-bounce' : 'text-yellow-500'} />}
            footer={`${summary?.risk?.days || 0} days remaining`}
            highlight={inventory[0].currentStock < inventory[0].safetyStock}
          />
          <Card 
            title="Procurement Plan" 
            value={summary?.procurement?.units || "Pending"} 
            unit="Units"
            icon={<Truck className="text-purple-500" />}
            footer={summary?.procurement?.supplier || "Optimizing"}
          />
        </div>

        {/* Main Viewport */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {/* Sales Chart */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Real-time Demand Analytics
                </h3>
                <span className="text-[10px] bg-slate-50 text-slate-400 font-black px-3 py-1.5 rounded-full uppercase tracking-tighter">Rolling 14-Day View</span>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sales}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize: 10}} stroke="#94a3b8" />
                    <YAxis tick={{fontSize: 10}} stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="unitsSold" 
                      stroke="#2563eb" 
                      strokeWidth={4} 
                      dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} 
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparison Tool / Recommendation Engine */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Scale className="w-5 h-5 text-purple-500" />
                    Supplier Comparison Engine
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 italic">Comparing cost vs. reliability for urgent replenishment.</p>
                </div>
                {!showComparison && (
                  <button 
                    onClick={handleCompareSuppliers}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Run AI Comparison
                  </button>
                )}
              </div>

              {showComparison ? (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  {comparing ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                      <p className="text-sm font-medium">Analyzing supplier metrics and lead times...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {comparison?.comparison?.map((s: any, idx: number) => (
                          <div key={idx} className={`p-5 rounded-2xl border-2 transition-all ${s.rank === 1 ? 'border-blue-100 bg-blue-50/30 ring-1 ring-blue-200' : 'border-slate-100 bg-white'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                {s.rank === 1 && <Award className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                {s.name}
                              </h4>
                              <span className="text-xs font-black px-2 py-1 bg-white rounded-lg border border-slate-100">Score: {s.score}/100</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase font-black text-slate-400">Strengths</p>
                                {s.pros.map((pro: string, i: number) => (
                                  <p key={i} className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {pro}
                                  </p>
                                ))}
                              </div>
                              <div className="space-y-1.5">
                                <p className="text-[10px] uppercase font-black text-slate-400">Risks</p>
                                {s.cons.map((con: string, i: number) => (
                                  <p key={i} className="text-[11px] text-red-700 font-medium flex items-center gap-1">
                                    <XCircle className="w-3 h-3" /> {con}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* AI Winner Badge */}
                      <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10">
                          <Zap className="w-32 h-32 text-blue-400" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">ChainMind Choice</span>
                            <span className="text-blue-400 text-[10px] font-bold uppercase">{inventory[0].currentStock < inventory[0].safetyStock ? 'URGENT MODE ACTIVE' : 'OPTIMIZED CHOICE'}</span>
                          </div>
                          <h4 className="text-xl font-black mb-2">Recommended: {comparison?.winner?.name}</h4>
                          <p className="text-sm text-slate-300 leading-relaxed italic mb-4">"{comparison?.winner?.reasoning}"</p>
                          <div className="flex gap-4">
                            <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl text-xs font-extrabold transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                              Approve & Purchase
                            </button>
                            <button onClick={() => setShowComparison(false)} className="text-slate-400 hover:text-white px-4 py-3 text-xs font-bold transition-all underline underline-offset-4">
                              Reset Analysis
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center px-8 border-2 border-dashed border-slate-100 rounded-2xl">
                  <div className="bg-slate-50 p-4 rounded-3xl mb-4">
                    <Scale className="w-8 h-8 text-slate-300" />
                  </div>
                  <h4 className="font-bold text-slate-700 mb-1 italic">Waiting for Command</h4>
                  <p className="text-xs text-slate-400 max-w-sm">Use the AI engine to evaluate supplier performance metrics against current inventory constraints.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Activity & Logistics */}
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl h-[350px] flex flex-col">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Live Feed
              </h3>
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {activityLog.map((log, i) => (
                  <div key={i} className={`flex gap-3 items-start animate-in slide-in-from-right duration-500`}>
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${log.type === 'warn' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]'}`}></div>
                    <div>
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">{log.time}</p>
                      <p className={`text-xs leading-relaxed ${log.type === 'warn' ? 'text-red-300 font-bold' : 'text-slate-300'}`}>
                        {log.msg}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-slate-400" />
                Logistics Pulse
              </h3>
              <div className="space-y-3">
                {logistics.map((l, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50 hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl transition-colors ${l.riskFactors === 'None' ? 'bg-green-100/50 text-green-600' : 'bg-orange-100/50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white'}`}>
                        <Timer className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{l.route}</p>
                        <p className="text-[10px] text-slate-400 font-medium">ETA: {l.avgDeliveryTimeDays} Day</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${l.riskFactors === 'None' ? 'text-green-600 bg-green-50' : 'text-orange-600 bg-orange-50 animate-pulse'}`}>
                      {l.riskFactors}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Drawer */}
      <div className="w-full lg:w-[420px] bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl z-20">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">ChainMind GPT</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active Analysis Engine</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white/50 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <p className="text-xs text-slate-400 italic mb-6">"Main aapka supply chain expert assistant hoon. Aaj kya help karun?"</p>
              <div className="space-y-3">
                <SuggestionButton text="Live sales data summary" onClick={() => setInput("Live sales data ka summary dikhao")} />
                <SuggestionButton text="Next procurement recommendation" onClick={() => setInput("Humein next kitna aur kab order karna chahiye?")} />
                <SuggestionButton text="Logistics delays risk analysis" onClick={() => setInput("Logistics mein kya risks hain abhi?")} />
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`max-w-[90%] p-4 rounded-3xl text-sm shadow-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100' 
                  : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none font-medium'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-100/80 p-4 rounded-3xl rounded-bl-none">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 bg-white border-t border-slate-100">
          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask ChainMind GPT..."
              className="w-full py-4.5 pl-6 pr-14 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all placeholder:text-slate-400 shadow-inner"
            />
            <button 
              onClick={handleSend}
              className="absolute right-2.5 top-2.5 p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-90 disabled:opacity-50"
              disabled={!input.trim() || isTyping}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  footer: string;
  highlight?: boolean;
}

const Card: React.FC<CardProps> = ({ title, value, unit, icon, footer, highlight }) => (
  <div className={`bg-white p-6 rounded-3xl shadow-sm border transition-all duration-700 ${highlight ? 'border-red-500 ring-4 ring-red-50 shadow-red-100' : 'border-slate-100'} hover:shadow-xl hover:shadow-slate-200/50 group`}>
    <div className="flex justify-between items-start mb-5">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      <div className={`p-2.5 rounded-2xl transition-all duration-500 group-hover:scale-110 ${highlight ? 'bg-red-50' : 'bg-slate-50'}`}>{icon}</div>
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className={`text-3xl font-black tracking-tight transition-colors duration-500 ${highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</span>
      <span className="text-xs text-slate-400 font-bold uppercase tracking-tighter">{unit}</span>
    </div>
    <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
      <p className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-red-500' : 'text-slate-300'}`}>{footer}</p>
      {highlight && <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>}
    </div>
  </div>
);

const SuggestionButton: React.FC<{text: string, onClick: () => void}> = ({ text, onClick }) => (
  <button 
    onClick={onClick}
    className="w-full text-left p-4 text-xs font-bold bg-white border border-slate-100 rounded-2xl hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all shadow-sm active:scale-95 flex items-center justify-between group"
  >
    {text}
    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
  </button>
);

export default App;
