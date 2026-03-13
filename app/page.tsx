'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bird, 
  Egg, 
  Coins, 
  Activity, 
  TrendingUp, 
  History, 
  Trash2, 
  FileText, 
  Image as ImageIcon,
  Plus,
  Languages,
  PieChart,
  AlertCircle,
  Home,
  LogOut,
  Lock,
  User,
  Mail,
  Settings as SettingsIcon,
  ChevronRight,
  UserCircle
} from 'lucide-react';
import { translations, Language } from '@/lib/translations';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

interface PoultryLog {
  id: string;
  user_id: string;
  date: string;
  count: number;
  eggs: number;
  feed: number;
  income: number;
  expense: number;
  notes: string;
  created_at?: string;
}

export default function PoultryManager() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [logs, setLogs] = useState<PoultryLog[]>([]);
  const [lang, setLang] = useState<Language>('en');
  const [fullName, setFullName] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'reports' | 'profile'>('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const t = translations[lang];
  const userDisplayName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'User';
  const userAvatar = session?.user?.user_metadata?.avatar_url || null;

  // Auth & Session Management
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.user_metadata?.full_name) {
        setFullName(session.user.user_metadata.full_name);
      }
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (session) {
      fetchLogs();
    } else {
      setLogs([]);
    }
  }, [session]);

  // Language Persistence
  useEffect(() => {
    const savedLang = localStorage.getItem('poultry_lang_v5') as Language;
    if (savedLang) setLang(savedLang);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('poultry_lang_v5', lang);
    }
  }, [lang, isLoaded]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('poultry_logs')
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching logs:', error);
    } else {
      setLogs(data || []);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });
      if (error) setAuthError(error.message);
      else setAuthError('Check your email for the confirmation link.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setIsUpdatingProfile(true);

    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: fullName,
        avatar_url: profileImage || session.user.user_metadata.avatar_url
      }
    });

    setIsUpdatingProfile(false);
    if (error) {
      alert(error.message);
    } else {
      alert(t.profileUpdated);
      setIsSettingsOpen(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfileImage(publicUrl);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const addEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session?.user) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const newLog = {
      user_id: session.user.id,
      date: formData.get('date') as string,
      count: parseInt(formData.get('count') as string) || 0,
      eggs: parseInt(formData.get('eggs') as string) || 0,
      feed: parseInt(formData.get('feed') as string) || 0,
      income: parseFloat(formData.get('income') as string) || 0,
      expense: parseFloat(formData.get('expense') as string) || 0,
      notes: formData.get('notes') as string,
    };

    const { data, error } = await supabase
      .from('poultry_logs')
      .insert([newLog])
      .select();

    if (error) {
      console.error('Error adding log:', error);
      alert('Failed to save record.');
    } else if (data) {
      setLogs([data[0], ...logs]);
      form.reset();
      setActiveTab('dashboard');
    }
  };

  const deleteEntry = async (id: string) => {
    if (window.confirm(t.confirmDelete)) {
      const { error } = await supabase
        .from('poultry_logs')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting log:', error);
        alert('Failed to delete record.');
      } else {
        setLogs(logs.filter(l => l.id !== id));
      }
    }
  };

  const exportRecord = async (log: PoultryLog, formatType: 'pdf' | 'jpg') => {
    if (!exportRef.current) return;
    
    const element = exportRef.current;
    element.style.display = 'block';
    
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      if (formatType === 'jpg') {
        const link = document.createElement('a');
        link.download = `poultry_record_${log.date}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
      } else {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
        pdf.save(`poultry_record_${log.date}.pdf`);
      }
    } finally {
      element.style.display = 'none';
    }
  };

  const stats = {
    totalEggs: logs.reduce((a, b) => a + b.eggs, 0),
    netProfit: logs.reduce((a, b) => a + (b.income - b.expense), 0),
    efficiency: logs.length ? (logs.reduce((a, b) => a + (b.eggs / b.count), 0) / logs.length * 100).toFixed(1) : '0',
    costPerEgg: logs.reduce((a, b) => a + b.eggs, 0) > 0 
      ? (logs.reduce((a, b) => a + b.expense, 0) / logs.reduce((a, b) => a + b.eggs, 0)).toFixed(2) 
      : '0.00'
  };

  if (!isLoaded || loadingAuth) return null;

  // Render Auth Screen if not logged in
  if (!session) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#020617] text-white flex flex-col items-center justify-center p-6 sm:max-w-md sm:mx-auto sm:border-x sm:border-white/5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center text-[#ccff00] border border-white/10 mx-auto mb-6 shadow-[0_0_30px_rgba(204,255,0,0.1)]">
              <Bird size={40} strokeWidth={1.5} className="drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
            </div>
            <h1 className="text-4xl font-display font-bold text-white tracking-tight mb-2">{t.title}</h1>
            <p className="text-[#0f172a] text-[10px] font-black uppercase tracking-[0.2em] bg-[#ccff00] inline-block px-3 py-1 rounded-full">{t.company}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 bg-white/5 p-8 rounded-[2.5rem] shadow-2xl border border-white/10 backdrop-blur-xl">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.fullName}</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-medium text-white focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-medium text-white focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-4 text-sm font-medium text-white focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {authError && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-[10px] text-red-400 font-bold text-center bg-red-500/10 py-2 rounded-xl border border-red-500/20"
              >
                {authError}
              </motion.p>
            )}

            <button type="submit" className="w-full bg-[#ccff00] text-[#0f172a] py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#ccff00]/20 hover:shadow-xl hover:shadow-[#ccff00]/30 active:scale-[0.98] transition-all mt-4 border border-[#ccff00]">
              {isSignUp ? t.createAccount : t.signIn}
            </button>

            <div className="text-center pt-4">
              <button 
                type="button" 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#ccff00] transition-colors"
              >
                {isSignUp ? t.alreadyHaveAccount : t.needAccount}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] bg-[#020617] text-white flex flex-col relative overflow-hidden sm:max-w-md sm:mx-auto sm:border-x sm:border-white/5" dir={t.dir}>
      
      {/* Top Header */}
      <header className="pt-safe px-6 pb-4 flex justify-between items-center z-10 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ccff00] rounded-xl flex items-center justify-center text-[#0f172a] shadow-lg shadow-[#ccff00]/10">
            <Bird size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-white leading-tight">{t.title}</h1>
            <p className="text-[#0f172a] text-[9px] font-black uppercase tracking-widest bg-[#ccff00] px-2 py-0.5 rounded-full inline-block">{t.company}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="relative">
            <select 
              value={lang} 
              onChange={(e) => setLang(e.target.value as Language)}
              className="appearance-none bg-white/5 border border-white/10 text-white text-[10px] font-black py-2 pl-3 pr-8 rounded-xl outline-none focus:border-[#ccff00] transition-colors"
            >
              <option value="en" className="bg-[#020617]">EN</option>
              <option value="fr" className="bg-[#020617]">FR</option>
            </select>
            <Languages size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          
          {/* Profile Avatar */}
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${activeTab === 'profile' ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]' : 'border-white/10 bg-white/5 text-slate-500'}`}
          >
            <User size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>


      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-32 hide-scrollbar">
        <AnimatePresence mode="wait">
          
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              {/* Welcome Message */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                    {t.welcome}, <span className="text-[#0f172a] bg-[#ccff00] px-2 rounded-lg">{userDisplayName}</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Here is your farm overview today.</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t.totalEggs, value: stats.totalEggs, icon: Egg, color: 'text-white', bg: 'bg-white/5' },
                  { label: t.profit, value: `${stats.netProfit.toFixed(2)} TND`, icon: Coins, color: stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400', bg: 'bg-white/5' },
                  { label: t.efficiency, value: `${stats.efficiency}%`, icon: Activity, color: 'text-[#0f172a]', bg: 'bg-[#ccff00]' },
                  { label: t.costPerEgg, value: `${stats.costPerEgg} TND`, icon: TrendingUp, color: 'text-slate-500', bg: 'bg-white/5' }
                ].map((stat, i) => (
                  <div key={i} className={`${stat.bg} p-5 rounded-[2rem] border border-white/10 flex flex-col justify-between aspect-square shadow-sm`}>
                    <div className="flex justify-between items-start">
                      <div className={`w-10 h-10 ${stat.bg === 'bg-[#ccff00]' ? 'bg-[#0f172a]/10' : 'bg-white/5'} rounded-2xl flex items-center justify-center`}>
                        <stat.icon size={18} className={stat.bg === 'bg-[#ccff00]' ? 'text-[#0f172a]/50' : 'text-slate-500'} />
                      </div>
                    </div>
                    <div>
                      <h3 className={`text-2xl font-display font-bold mb-1 ${stat.color}`}>{stat.value}</h3>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${stat.bg === 'bg-[#ccff00]' ? 'text-[#0f172a]/40' : 'text-slate-500'}`}>{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent History */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-display font-bold text-white uppercase tracking-widest">{t.history}</h2>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">{logs.length} Records</span>
                </div>
                
                <div className="space-y-3">
                  {logs.length > 0 ? logs.slice(0, 5).map((log, i) => (
                    <div key={log.id} className="bg-white/5 border border-white/10 p-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="bg-[#ccff00] w-12 h-12 rounded-2xl flex flex-col items-center justify-center border border-white/10">
                        <span className="text-sm font-display font-bold text-[#0f172a] leading-none">{log.date.split('-')[2]}</span>
                        <span className="text-[8px] font-black uppercase text-[#0f172a]/40 mt-1">{format(new Date(log.date), 'MMM')}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-display font-bold text-sm mb-0.5">{log.date}</p>
                        <div className="flex gap-3">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <Egg size={10} className="text-[#ccff00]" /> {log.eggs}
                          </span>
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${log.income - log.expense >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <Coins size={10} /> {(log.income - log.expense).toFixed(2)} TND
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => exportRecord(log, 'pdf')} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#ccff00] hover:bg-[#ccff00]/10 transition-all">
                          <FileText size={14} />
                        </button>
                        <button onClick={() => deleteEntry(log.id)} className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="py-16 text-center bg-white/5 rounded-[2.5rem] border border-white/10 shadow-sm">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={32} className="text-slate-700" />
                      </div>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{t.noData}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ADD RECORD TAB */}
          {activeTab === 'add' && (
            <motion.div 
              key="add"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">{t.newEntry}</h2>
                <p className="text-xs text-slate-500 font-medium">Log today&apos;s metrics for your flock.</p>
              </div>

              <form onSubmit={addEntry} className="space-y-5 bg-white/5 p-8 rounded-[2.5rem] shadow-xl border border-white/10 backdrop-blur-xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.date}</label>
                  <input 
                    type="date" 
                    name="date" 
                    required 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.count}</label>
                    <input type="number" name="count" placeholder="0" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.eggs}</label>
                    <input type="number" name="eggs" placeholder="0" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-1">{t.income}</label>
                    <input type="number" step="0.01" name="income" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-rose-400 ml-1">{t.expense}</label>
                    <input type="number" step="0.01" name="expense" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 outline-none transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.notes}</label>
                  <textarea name="notes" rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white placeholder-slate-600 focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all resize-none" placeholder="Add observations..."></textarea>
                </div>

                <button type="submit" className="w-full bg-[#ccff00] text-[#0f172a] py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#ccff00]/20 hover:shadow-xl hover:shadow-[#ccff00]/30 active:scale-[0.98] transition-all mt-4 border border-[#ccff00]">
                  {t.save}
                </button>
              </form>
            </motion.div>
          )}

          {/* REPORTS TAB */}
          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-8"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-display font-bold text-white tracking-tight mb-2">{t.reports}</h2>
                <p className="text-xs text-slate-500 font-medium">Comprehensive performance analysis.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-xl backdrop-blur-xl">
                <div className="flex items-center gap-3 border-b border-white/5 pb-6">
                  <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-[#ccff00]">
                    <Coins size={20} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">{t.finBreakdown}</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-medium">{t.grossRev}</span>
                    <span className="text-xl font-display font-bold text-emerald-400">+ {logs.reduce((a,b)=>a+b.income,0).toFixed(2)} TND</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 text-sm font-medium">{t.opCosts}</span>
                    <span className="text-xl font-display font-bold text-rose-400">- {logs.reduce((a,b)=>a+b.expense,0).toFixed(2)} TND</span>
                  </div>
                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.profit}</span>
                    <span className="text-4xl font-display font-bold text-white">{(logs.reduce((a,b)=>a+b.income,0) - logs.reduce((a,b)=>a+b.expense,0)).toFixed(2)} <span className="text-sm">TND</span></span>
                  </div>
                </div>
              </div>

              <div className="bg-[#ccff00] border border-white/10 rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-[#0f172a]/5 pb-6">
                  <div className="w-10 h-10 bg-[#0f172a]/5 rounded-2xl flex items-center justify-center text-[#0f172a]">
                    <Activity size={20} strokeWidth={2.5} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#0f172a]">{t.prodHealth}</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[#0f172a]/40 text-sm font-medium">{t.totalEggs}</span>
                    <span className="text-xl font-display font-bold text-[#0f172a]">{stats.totalEggs}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#0f172a]/40 text-sm font-medium">{t.efficiency}</span>
                    <span className="text-xl font-display font-bold text-[#0f172a]">{stats.efficiency}%</span>
                  </div>
                  <div className="pt-6 border-t border-[#0f172a]/5">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#0f172a]/40">{t.prodEfficiency}</span>
                    </div>
                    <div className="w-full h-3 bg-[#0f172a]/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.efficiency}%` }}
                        className="h-full bg-[#0f172a] shadow-[0_0_15px_rgba(15,23,42,0.3)]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="p-6 space-y-8"
            >
              {!isSettingsOpen ? (
                <>
                  <div className="text-center pt-8">
                    <div className="relative inline-block">
                      <div className="w-32 h-32 bg-white/5 rounded-[3rem] shadow-2xl border border-white/10 flex items-center justify-center text-white mx-auto mb-6 overflow-hidden">
                        {userAvatar ? (
                          <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={64} strokeWidth={1.5} />
                        )}
                      </div>
                    </div>
                    <h2 className="text-3xl font-display font-bold text-white tracking-tight">{userDisplayName}</h2>
                    <p className="text-sm text-slate-500 font-medium">{session.user.email}</p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: t.settings, icon: SettingsIcon, color: 'text-white', onClick: () => setIsSettingsOpen(true) },
                      { label: t.logout, icon: LogOut, color: 'text-rose-400', onClick: handleLogout }
                    ].map((item, i) => (
                      <button 
                        key={i} 
                        onClick={item.onClick}
                        className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md active:scale-[0.99] transition-all backdrop-blur-xl"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center ${item.color}`}>
                            <item.icon size={18} strokeWidth={2.5} />
                          </div>
                          <span className={`text-sm font-bold uppercase tracking-widest ${item.color}`}>{item.label}</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-700" />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <h2 className="text-2xl font-display font-bold text-white">{t.settings}</h2>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-6 bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl">
                    <div className="flex flex-col items-center mb-6">
                      <div className="relative group">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center text-white overflow-hidden">
                          {profileImage || userAvatar ? (
                            <img src={profileImage || userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User size={40} strokeWidth={1.5} />
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#ccff00] rounded-xl flex items-center justify-center text-[#0f172a] cursor-pointer shadow-lg hover:scale-110 transition-transform">
                          <Plus size={16} strokeWidth={3} />
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-3">{t.uploadImage}</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.fullName}</label>
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white focus:border-[#ccff00] focus:ring-4 focus:ring-[#ccff00]/10 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t.email}</label>
                      <input 
                        type="email" 
                        value={session.user.email}
                        disabled
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-slate-500 outline-none cursor-not-allowed"
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={isUpdatingProfile}
                      className="w-full bg-[#ccff00] text-[#0f172a] py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#ccff00]/20 hover:shadow-xl hover:shadow-[#ccff00]/30 active:scale-[0.98] transition-all mt-4 border border-[#ccff00] disabled:opacity-50"
                    >
                      {isUpdatingProfile ? t.saving : t.save}
                    </button>
                  </form>
                </div>
              )}

              <div className="pt-8 text-center">
                <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Chicken Manager Pro v2.0</p>
              </div>
            </motion.div>
          )}


        </AnimatePresence>
      </main>

      {/* Bottom Navigation Bar */}
      <div className="absolute bottom-0 w-full pb-safe pt-3 px-6 bg-[#020617]/90 backdrop-blur-2xl border-t border-white/5 z-50 flex justify-around items-center">
        <button 
          onClick={() => setActiveTab('dashboard')} 
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-600 hover:text-slate-500'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'dashboard' ? 'bg-[#ccff00] shadow-lg shadow-[#ccff00]/20' : ''}`}>
            <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} className={activeTab === 'dashboard' ? 'text-[#0f172a]' : ''} />
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Home</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('add')} 
          className="relative -top-6 w-16 h-16 bg-[#ccff00] rounded-[2rem] flex items-center justify-center text-[#0f172a] shadow-2xl shadow-[#ccff00]/30 active:scale-90 transition-all border-4 border-[#020617]"
        >
          <Plus size={32} strokeWidth={3} />
        </button>
        
        <button 
          onClick={() => setActiveTab('reports')} 
          className={`flex flex-col items-center gap-1 p-2 transition-all ${activeTab === 'reports' ? 'text-white' : 'text-slate-600 hover:text-slate-500'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'reports' ? 'bg-[#ccff00] shadow-lg shadow-[#ccff00]/20' : ''}`}>
            <PieChart size={22} strokeWidth={activeTab === 'reports' ? 2.5 : 2} className={activeTab === 'reports' ? 'text-[#0f172a]' : ''} />
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest mt-1">Reports</span>
        </button>
      </div>

      {/* Hidden Export Template (Kept Light for PDF/JPG readability) */}
      <div 
        ref={exportRef}
        style={{ display: 'none', position: 'fixed', left: '-9999px', top: 0, width: '800px', backgroundColor: '#ffffff', color: '#0f172a' }}
        className="p-16"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-12 border-b-2 border-[#f1f5f9] pb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center text-[#f59e0b]">
              <Bird size={36} strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-[#0f172a] tracking-tight">{t.title}</h1>
              <p className="text-[#f59e0b] text-xs font-black uppercase tracking-widest mt-1">{t.company}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-1">{t.date}</p>
            <p className="text-xl font-display font-bold text-[#0f172a]">
              {logs[0]?.date || format(new Date(), 'yyyy-MM-dd')}
            </p>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-[#f8fafc] rounded-3xl p-8 border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-6">
              <Activity size={20} className="text-[#3b82f6]" />
              <h2 className="text-xs font-black text-[#64748b] uppercase tracking-widest">Production</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2">{t.count}</p>
                <p className="text-4xl font-display font-bold text-[#0f172a]">{logs[0]?.count || 0}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2">{t.eggs}</p>
                <p className="text-4xl font-display font-bold text-[#0f172a]">{logs[0]?.eggs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#f8fafc] rounded-3xl p-8 border border-[#e2e8f0]">
            <div className="flex items-center gap-3 mb-6">
              <Coins size={20} className="text-[#f59e0b]" />
              <h2 className="text-xs font-black text-[#64748b] uppercase tracking-widest">Financials</h2>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-black text-[#10b981] uppercase tracking-widest mb-2">{t.income}</p>
                <p className="text-2xl font-display font-bold text-[#10b981]">{logs[0]?.income?.toFixed(2) || '0.00'} <span className="text-sm">TND</span></p>
              </div>
              <div>
                <p className="text-[10px] font-black text-[#ef4444] uppercase tracking-widest mb-2">{t.expense}</p>
                <p className="text-2xl font-display font-bold text-[#ef4444]">{logs[0]?.expense?.toFixed(2) || '0.00'} <span className="text-sm">TND</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Profit Summary */}
        <div className="bg-[#0f172a] rounded-3xl p-8 mb-12 flex justify-between items-center shadow-lg">
          <div>
            <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-1">Net Profit</p>
            <p className="text-sm text-[#cbd5e1]">Income minus expenses</p>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-display font-bold ${((logs[0]?.income || 0) - (logs[0]?.expense || 0)) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              {((logs[0]?.income || 0) - (logs[0]?.expense || 0)).toFixed(2)} <span className="text-xl">TND</span>
            </p>
          </div>
        </div>

        {/* Notes Section */}
        {logs[0]?.notes && (
          <div className="mb-8">
            <h2 className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-4 border-b border-[#e2e8f0] pb-2">{t.notes}</h2>
            <div className="p-6 bg-[#fffbeb] rounded-2xl border-l-4 border-[#f59e0b]">
              <p className="text-[#334155] font-medium text-lg leading-relaxed">&ldquo;{logs[0].notes}&rdquo;</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-[#e2e8f0] text-center">
          <p className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest">Generated by {t.title} App &bull; {format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
        </div>
      </div>
    </div>
  );
}
