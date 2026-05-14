import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Leaf, Award, Activity, Droplet, Sprout, Flower2, 
  TreeDeciduous, History, X, Info, 
  CheckCircle2, Zap, Bike, Recycle, Coffee, ShoppingBag,
  Mountain, Sparkles, User, Users, Heart
} from 'lucide-react';
import { supabase } from './lib/supabase';

// Stages of evolution based on level
const getEvolutionStage = (level: number) => {
  if (level < 3) return { icon: Sprout, name: "Семя Света", color: "text-emerald-400", bg: "bg-emerald-500/20", description: "Твое путешествие начинается. Маленький росток надежды." };
  if (level < 7) return { icon: Flower2, name: "Цветок Ауры", color: "text-cyan-400", bg: "bg-cyan-500/20", description: "Твои старания расцветают. Энергия природы наполняет тебя." };
  if (level < 11) return { icon: TreeDeciduous, name: "Древо Жизни", color: "text-purple-400", bg: "bg-purple-500/20", description: "Ты стал хранителем баланса. Твоя Аура питает всё живое." };
  if (level < 16) return { icon: Mountain, name: "Дух Гор", color: "text-indigo-400", bg: "bg-indigo-500/20", description: "Твоя мудрость непоколебима, как вечные горы. Ты видишь дальше других." };
  return { icon: Sparkles, name: "Эфирный Хранитель", color: "text-rose-400", bg: "bg-rose-500/20", description: "Ты слился с энергией планеты. Твоя Аура — это чистый свет перемен." };
};

interface LogEntry {
  id: string;
  name: string;
  xp: number;
  timestamp: number;
  iconName: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  level: number;
  xp: number;
  isYou: boolean;
}

const ACTIONS = [
  { id: 'cup', name: 'Своя кружка', xp: 30, icon: Coffee, color: 'text-emerald-400', bg: 'bg-emerald-500/10', hint: 'Экономит пластик и бумагу' },
  { id: 'walk', name: 'Пешком / Вело', xp: 60, icon: Bike, color: 'text-cyan-400', bg: 'bg-cyan-500/10', hint: 'Снижает выбросы CO2' },
  { id: 'sort', name: 'Сортировка', xp: 40, icon: Recycle, color: 'text-purple-400', bg: 'bg-purple-500/10', hint: 'Дает вещам вторую жизнь' },
  { id: 'bag', name: 'Своя сумка', xp: 20, icon: ShoppingBag, color: 'text-amber-400', bg: 'bg-amber-500/10', hint: 'Минус один пакет в океане' },
  { id: 'water', name: 'Экономия воды', xp: 25, icon: Droplet, color: 'text-blue-400', bg: 'bg-blue-500/10', hint: 'Бережное отношение к ресурсам' },
  { id: 'energy', name: 'Выключил свет', xp: 15, icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10', hint: 'Экономия электроэнергии' },
];

declare global {
  interface Window {
    Telegram: any;
  }
}

export default function App() {
  const [tg, setTg] = useState<any>(null);
  const [energy, setEnergy] = useState(() => Number(localStorage.getItem('aura_energy')) || 0);
  const [level, setLevel] = useState(() => Number(localStorage.getItem('aura_level')) || 1);
  const [history, setHistory] = useState<LogEntry[]>(() => JSON.parse(localStorage.getItem('aura_history') || '[]'));
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('aura_onboarded'));
  
  const [showLogMenu, setShowLogMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showDonation, setShowDonation] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [floatingTexts, setFloatingTexts] = useState<{id: number, val: number}[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Daily Quests
  const [dailyQuests] = useState<string[]>(() => {
    const saved = localStorage.getItem('aura_daily_quests');
    const lastDate = localStorage.getItem('aura_last_quest_date');
    const today = new Date().toDateString();
    
    if (saved && lastDate === today) return JSON.parse(saved);
    
    // Pick 3 random actions
    const shuffled = [...ACTIONS].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3).map(a => a.id);
    localStorage.setItem('aura_daily_quests', JSON.stringify(picked));
    localStorage.setItem('aura_last_quest_date', today);
    return picked;
  });

  // Initialize Telegram & Load Cloud Data
  useEffect(() => {
    const initApp = async () => {
      let userId = 'local_user';
      let firstName = 'Герой';

      if (window.Telegram?.WebApp) {
        const tgApp = window.Telegram.WebApp;
        tgApp.ready();
        tgApp.expand();
        setTg(tgApp);
        
        tgApp.setHeaderColor('#020617');
        tgApp.setBackgroundColor('#020617');

        if (tgApp.initDataUnsafe?.user) {
          userId = tgApp.initDataUnsafe.user.id.toString();
          firstName = tgApp.initDataUnsafe.user.first_name;
        }
      }

      // Load from Supabase
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (data) {
          setEnergy(data.energy);
          setLevel(data.level);
          setHistory(data.history || []);
        } else {
          // New user: Create profile
          await supabase.from('profiles').insert({
            id: userId,
            username: firstName,
            energy: 0,
            level: 1,
            history: []
          });
        }
      } catch (err) {
        console.error("Supabase load error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // Handle Telegram BackButton
  useEffect(() => {
    if (!tg) return;

    const handleBack = () => {
      if (showHistory) setShowHistory(false);
      else if (showLeaderboard) setShowLeaderboard(false);
      else if (showDonation) setShowDonation(false);
      else if (showLogMenu) setShowLogMenu(false);
    };

    if (showHistory || showLeaderboard || showLogMenu || showDonation) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
      tg.BackButton.offClick(handleBack);
    }

    return () => tg.BackButton.offClick(handleBack);
  }, [tg, showHistory, showLogMenu]);
  }, [tg, showHistory, showLogMenu, showLeaderboard, showDonation]);

  // Sync with Cloud (Debounced)
  useEffect(() => {
    if (isLoading || !userId) return;

    const syncData = async () => {
      await supabase.from('profiles').upsert({
        id: userId,
        username: userName,
        energy: energy,
        level: level,
        history: history,
        updated_at: new Date().toISOString()
      });
    };

    const timer = setTimeout(syncData, 1000);
    return () => clearTimeout(timer);
  }, [energy, level, history, isLoading, userId, userName]);

  const resetData = async () => {
    if (!window.confirm('Вы уверены, что хотите полностью сбросить свой прогресс? Это действие нельзя отменить.')) {
      return;
    }

    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('warning');

    try {
      if (userId) {
        await supabase
          .from('profiles')
          .update({ 
            energy: 0, 
            level: 1, 
            history: [] 
          })
          .eq('id', userId);
      }
      
      setEnergy(0);
      setLevel(1);
      setHistory([]);
      
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
      window.location.reload();
    } catch (error) {
      console.error('Error resetting data:', error);
      alert('Ошибка при сбросе данных');
    }
  };

  // Fetch Leaderboard
  useEffect(() => {
    if (showLeaderboard) {
      const fetchLeaderboard = async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, level, energy')
          .order('level', { ascending: false })
          .order('energy', { ascending: false })
          .limit(50);

        if (data) {
          const formatted = data.map((p) => ({
            id: p.id,
            name: p.username,
            level: p.level,
            xp: p.energy,
            isYou: p.id === userId
          }));
          setLeaderboard(formatted);
          
          const myIndex = data.findIndex(p => p.id === userId);
          setUserRank(myIndex !== -1 ? myIndex + 1 : null);
        }
      };
      fetchLeaderboard();
    }
  }, [showLeaderboard, userId]);

  const xpForNextLevel = level * 100;
  const progress = (energy / xpForNextLevel) * 100;

  const logAction = (action: typeof ACTIONS[0]) => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred('medium');
    }

    const isDaily = dailyQuests.includes(action.id);
    const xpGain = isDaily ? action.xp * 2 : action.xp;

    let newEnergy = energy + xpGain;
    let newLevel = level;
    let leveledUp = false;

    while (newEnergy >= (newLevel * 100)) {
      newEnergy -= (newLevel * 100);
      newLevel += 1;
      leveledUp = true;
    }

    setEnergy(newEnergy);
    setLevel(newLevel);
    if (leveledUp) {
      setShowLevelUp(true);
      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    }

    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      name: action.name + (isDaily ? ' (x2)' : ''),
      xp: xpGain,
      timestamp: Date.now(),
      iconName: action.id
    };
    
    setHistory(prev => [newEntry, ...prev].slice(0, 20));
    setShowLogMenu(false);
    
    const id = Date.now();
    setFloatingTexts(prev => [...prev, { id, val: xpGain }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 2000);
  };

  const finishOnboarding = () => {
    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    localStorage.setItem('aura_onboarded', 'true');
    setShowOnboarding(false);
  };

  const Stage = getEvolutionStage(level);
  const accentGradient = level < 3 ? 'from-emerald-500 to-emerald-400' : level < 7 ? 'from-cyan-500 to-cyan-400' : level < 11 ? 'from-purple-500 to-purple-400' : level < 16 ? 'from-indigo-500 to-indigo-400' : 'from-rose-500 to-rose-400';
  const accentBorder = level < 3 ? 'border-emerald-500/20' : level < 7 ? 'border-cyan-500/20' : level < 11 ? 'border-purple-500/20' : level < 16 ? 'border-indigo-500/20' : 'border-rose-500/20';

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-50 flex flex-col relative overflow-hidden font-sans select-none transition-colors duration-1000`}>
      <div className="absolute top-0 left-0 w-full h-12 z-[60] pointer-events-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      
      <motion.div 
        animate={{ backgroundColor: level < 3 ? 'rgba(16, 185, 129, 0.15)' : level < 7 ? 'rgba(6, 182, 212, 0.15)' : level < 11 ? 'rgba(168, 85, 247, 0.15)' : level < 16 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(244, 63, 94, 0.15)' }}
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none transition-colors duration-1000" 
      />

      <header className="px-6 py-8 mt-4 flex justify-between items-center relative z-10">
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <h1 className={`text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${accentGradient} transition-all duration-1000`}>
            Aura
          </h1>
          <p className="text-xs text-slate-400 font-medium">Привет, {userName} • {Stage.name}</p>
        </div>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <motion.button 
            onClick={() => setShowDonation(true)}
            animate={{ 
              scale: [1, 1.15, 1],
              filter: [
                'drop-shadow(0 0 2px #f43f5e) drop-shadow(0 0 5px #f43f5e)',
                'drop-shadow(0 0 5px #f43f5e) drop-shadow(0 0 15px #f43f5e)',
                'drop-shadow(0 0 2px #f43f5e) drop-shadow(0 0 5px #f43f5e)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", times: [0, 0.5, 1] }}
            className={`w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 hover:text-rose-400 hover:bg-rose-500/20 transition-colors`}
          >
            <Heart className="w-5 h-5 fill-rose-500/20" />
          </motion.button>
          <button onClick={() => setShowLeaderboard(true)} className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors`}>
            <Users className="w-5 h-5" />
          </button>
          <button onClick={() => setShowHistory(true)} className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors`}>
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10 -mt-10">
        <AnimatePresence>
          {floatingTexts.map(text => (
            <motion.div
              key={text.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -120, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={`absolute z-50 text-2xl font-bold ${Stage.color} glow-text pointer-events-none`}
            >
              +{text.val} XP
            </motion.div>
          ))}
        </AnimatePresence>

        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
            boxShadow: [
              `0 0 60px -15px ${level < 3 ? 'rgba(16,185,129,0.2)' : level < 7 ? 'rgba(6,182,212,0.2)' : 'rgba(168,85,247,0.2)'}`,
              `0 0 100px -10px ${level < 3 ? 'rgba(16,185,129,0.4)' : level < 7 ? 'rgba(6,182,212,0.4)' : 'rgba(168,85,247,0.4)'}`,
              `0 0 60px -15px ${level < 3 ? 'rgba(16,185,129,0.2)' : level < 7 ? 'rgba(6,182,212,0.2)' : 'rgba(168,85,247,0.2)'}`
            ]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="w-64 h-64 rounded-full flex items-center justify-center relative"
        >
          <div className={`absolute inset-0 rounded-full ${Stage.bg} backdrop-blur-xl border border-white/10 flex items-center justify-center transition-colors duration-1000`}>
             <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute inset-4 rounded-full border border-white/5 border-dashed" />
             <AnimatePresence mode="wait">
               <motion.div
                 key={level}
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0, opacity: 0 }}
                 transition={{ type: "spring", stiffness: 200, damping: 20 }}
               >
                 <Stage.icon className={`w-24 h-24 ${Stage.color} filter drop-shadow-[0_0_15px_currentColor] transition-all duration-1000`} />
               </motion.div>
             </AnimatePresence>
          </div>
        </motion.div>

        <div className="mt-16 text-center w-full max-w-xs px-6">
          <div className="flex justify-between text-xs font-medium text-slate-400 mb-2 px-1">
            <span>Эволюция: {Math.round(progress)}%</span>
            <span>{energy} / {xpForNextLevel} XP</span>
          </div>
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
            <motion.div 
              className={`h-full bg-gradient-to-r ${accentGradient} transition-all duration-1000`}
              animate={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </main>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowLogMenu(true)}
          className={`w-16 h-16 rounded-full bg-gradient-to-tr ${accentGradient} flex items-center justify-center shadow-lg text-white transition-all duration-1000`}
        >
          <Leaf className="w-8 h-8" />
        </motion.button>
      </div>

      <AnimatePresence>
        {showLogMenu && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLogMenu(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md z-30" />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              className="absolute bottom-0 left-0 w-full bg-slate-900 rounded-t-3xl p-6 pt-8 pb-32 z-40 border-t border-white/10"
            >
              <div className="flex justify-between items-center mb-6 px-2">
                <div>
                  <h3 className={`text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${accentGradient}`}>Питать Ауру</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Сегодня x2 опыта за избранное</p>
                </div>
                <button onClick={() => setShowLogMenu(false)} className="p-2 text-slate-400 hover:text-white transition-colors"><X /></button>
              </div>
              
              <div className="space-y-6 max-w-md mx-auto">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-3 px-1 flex items-center gap-2">
                    <Zap className="w-3 h-3 text-yellow-400" /> ФОКУС ДНЯ
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {ACTIONS.filter(a => dailyQuests.includes(a.id)).map(action => (
                      <button key={action.id} onClick={() => logAction(action)} className={`bg-white/[0.03] hover:bg-white/[0.08] border ${accentBorder} rounded-2xl p-4 flex flex-col items-start gap-1 transition-all active:scale-95 text-left group relative overflow-hidden`}>
                        <div className="absolute top-2 right-2 bg-yellow-400/20 text-yellow-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-yellow-400/30">x2</div>
                        <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                          <action.icon className={`w-5 h-5 ${action.color}`} />
                        </div>
                        <span className="text-sm font-semibold">{action.name}</span>
                        <span className={`text-xs font-bold mt-1 ${action.color}`}>+{action.xp * 2} XP</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 mb-3 px-1">ОСТАЛЬНОЕ</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {ACTIONS.filter(a => !dailyQuests.includes(a.id)).map(action => (
                      <button key={action.id} onClick={() => logAction(action)} className={`bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-2xl p-4 flex flex-col items-start gap-1 transition-all active:scale-95 text-left group`}>
                        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                          <action.icon className={`w-5 h-5 text-slate-400`} />
                        </div>
                        <span className="text-sm font-semibold text-slate-300">{action.name}</span>
                        <span className={`text-xs font-bold mt-1 text-slate-500`}>+{action.xp} XP</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ x: "100%" }} 
            animate={{ x: 0 }} 
            exit={{ x: "100%" }} 
            className="absolute inset-0 bg-slate-950 z-50 p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${accentGradient}`}>История</h2>
              <button onClick={() => setShowHistory(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <History className="w-12 h-12 mb-4 opacity-20" />
                  <p>Здесь пока пусто...</p>
                </div>
              ) : (
                history.map(item => {
                  const actionType = ACTIONS.find(a => a.id === item.iconName);
                  const Icon = actionType?.icon || CheckCircle2;
                  return (
                    <div key={item.id} className={`bg-white/[0.03] border ${accentBorder} rounded-2xl p-4 flex items-center gap-4`}>
                      <div className={`w-10 h-10 rounded-full ${actionType?.bg || 'bg-white/5'} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${actionType?.color || 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleString('ru-RU')}</p>
                      </div>
                      <span className={`font-bold ${actionType?.color || 'text-slate-400'}`}>+{item.xp}</span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950 z-[100] flex flex-col items-center justify-center p-6 overflow-hidden"
          >
            <motion.div animate={{ x: [0, 50, -30, 0], y: [0, -40, 60, 0], scale: [1, 1.2, 0.9, 1] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute top-[-10%] left-[-10%] w-80 h-80 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
            <motion.div animate={{ x: [0, -60, 40, 0], y: [0, 80, -50, 0], scale: [1, 1.1, 1.3, 1] }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }} className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />

            <motion.div 
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative w-full max-w-sm bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl flex flex-col items-center"
            >
              <div className="absolute -top-12 w-24 h-24 bg-gradient-to-tr from-emerald-500 to-cyan-400 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.4)] flex items-center justify-center rotate-12">
                <Leaf className="w-12 h-12 text-white -rotate-12" />
              </div>

              <div className="mt-12 text-center">
                <h2 className="text-4xl font-black tracking-tight mb-3 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                  Aura
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed px-4">
                  Твои привычки меняют мир. Начни питать свою Ауру добрыми делами.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 w-full mt-10">
                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 flex items-center gap-4 group hover:bg-white/[0.06] transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400"><Activity className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Действуй</h4>
                    <p className="text-[11px] text-slate-300">Совершай эко-дела в реальности</p>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 flex items-center gap-4 group hover:bg-white/[0.06] transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400"><Zap className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Логируй</h4>
                    <p className="text-[11px] text-slate-300">Получай XP за каждую привычку</p>
                  </div>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 flex items-center gap-4 group hover:bg-white/[0.06] transition-colors">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400"><TreeDeciduous className="w-5 h-5" /></div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">Расти</h4>
                    <p className="text-[11px] text-slate-300">Развивай Ауру до Древа Жизни</p>
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(16, 185, 129, 0.4)" }}
                whileTap={{ scale: 0.98 }}
                onClick={finishOnboarding}
                className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white rounded-3xl font-bold mt-10 shadow-xl relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10">Начать путь</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaderboard && (
          <motion.div 
            initial={{ x: "100%" }} 
            animate={{ x: 0 }} 
            exit={{ x: "100%" }} 
            className="absolute inset-0 bg-slate-950 z-50 p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className={`text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${accentGradient}`}>Лидеры</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Лучшие хранители Ауры</p>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {leaderboard.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">Загрузка таблицы...</div>
              ) : (
                leaderboard.map((player, idx) => (
                  <div key={player.id} className={`bg-white/[0.03] border ${idx === 0 ? 'border-amber-500/30' : idx === 1 ? 'border-slate-400/30' : idx === 2 ? 'border-orange-500/30' : player.isYou ? `border-${level < 3 ? 'emerald' : level < 7 ? 'cyan' : level < 11 ? 'purple' : level < 16 ? 'indigo' : 'rose'}-500/30` : 'border-white/5'} rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden`}>
                    {idx < 3 && <div className={`absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : 'bg-orange-500 text-black'} rounded-bl-xl`}>{idx + 1}</div>}
                    
                    <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10`}>
                      <User className={`w-5 h-5 ${idx === 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm flex items-center gap-2">
                        {player.name}
                        {player.isYou && <span className={`text-[8px] bg-slate-500/20 text-slate-400 px-1.5 py-0.5 rounded-full`}>ВЫ</span>}
                      </p>
                      <p className="text-[10px] text-slate-500">Уровень {player.level}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-sm ${idx === 0 ? 'text-amber-400' : 'text-slate-300'}`}>{player.xp.toLocaleString()}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">XP</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <div className={`bg-gradient-to-r ${accentGradient} rounded-2xl p-4 flex items-center gap-4 text-white shadow-xl`}>
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black">
                  {userRank || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{userName} (Ты)</p>
                  <p className="text-[10px] opacity-80">{userRank === 1 ? 'Ты лучший хранитель!' : 'Продолжай питать Ауру'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm">{energy}</p>
                  <p className="text-[8px] opacity-80 font-bold uppercase">XP</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDonation && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: "100%", opacity: 0 }} 
            className="absolute inset-0 bg-slate-950 z-[120] p-6 flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-rose-500/10 blur-[100px] pointer-events-none" />
            <button onClick={() => setShowDonation(false)} className="absolute top-8 right-8 p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors z-10">
              <X className="w-6 h-6" />
            </button>

            <motion.div
              animate={{ scale: [1, 1.1, 1], filter: ['drop-shadow(0 0 15px rgba(244,63,94,0.4))', 'drop-shadow(0 0 35px rgba(244,63,94,0.7))', 'drop-shadow(0 0 15px rgba(244,63,94,0.4))'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-28 h-28 bg-rose-500/20 rounded-[32px] flex items-center justify-center mb-10 border border-rose-500/30"
            >
              <Heart className="w-14 h-14 text-rose-500 fill-rose-500/40" />
            </motion.div>

            <h2 className="text-4xl font-black text-center mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              Дар Ауры
            </h2>
            <p className="text-slate-400 text-center text-sm leading-relaxed max-w-[280px] mb-12">
              Твоя поддержка помогает нам развивать проект и делать мир чище. Каждое пожертвование питает наше общее будущее.
            </p>

            <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => tg?.openLink('https://yoomoney.ru/bill/pay/1H7GLQG155J.260418')}
                className="w-full py-5 bg-gradient-to-tr from-rose-600 to-rose-400 text-white rounded-3xl font-bold shadow-[0_0_40px_rgba(244,63,94,0.3)]"
              >
                Поддержать проект
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDonation(false)}
                className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-bold transition-all text-white/70"
              >
                Может позже
              </motion.button>

              <button
                onClick={resetData}
                className="w-full py-2 text-xs text-red-400/50 hover:text-red-400 transition-colors mt-4 uppercase tracking-widest font-bold"
              >
                Сбросить весь прогресс (DEBUG)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLevelUp && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 z-[110] flex flex-col items-center justify-center bg-emerald-500/10 backdrop-blur-xl p-10 text-center"
          >
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Award className="w-20 h-20 text-amber-400 mb-6 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]" />
            </motion.div>
            <h2 className="text-4xl font-black mb-2">НОВЫЙ УРОВЕНЬ!</h2>
            <p className="text-2xl font-bold text-emerald-400 mb-8">Уровень {level}</p>
            <div className="bg-white/10 rounded-2xl p-6 mb-10 backdrop-blur-md border border-white/10">
              <p className="text-sm text-slate-300 italic">"{Stage.description}"</p>
            </div>
            <button 
              onClick={() => setShowLevelUp(false)}
              className="px-10 py-4 bg-white text-slate-950 rounded-2xl font-bold active:scale-95 transition-transform"
            >
              Чудесно
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



