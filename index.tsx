import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_KEY;
const BOT_USERNAME = 'TimeAgreeBot'; // Убедитесь, что это совпадает с вашим ботом

// --- TYPES ---

type SlotType = 'ONE_TIME' | 'CYCLIC_WEEKLY';
type PlanTier = 'FREE' | 'GROUP_PRO' | 'BUSINESS';
type LangCode = 'en' | 'ru';

interface User {
  id: number;
  username: string;
  firstName: string;
  timezone: string;
  languageCode?: string;
  photoUrl?: string;
}

interface Group {
  id: number;
  title: string;
  tier: PlanTier;
  members: User[];
}

interface BusySlot {
  id: string;
  userId: number;
  groupId: number;
  type: SlotType;
  description?: string;
  startAt?: string;
  endAt?: string;
  dayOfWeek?: number;
  startTimeLocal?: string;
  endTimeLocal?: string;
}

interface PlanConfig {
  maxMembers: number;
  searchWindowDays: number;
  minSlotDurationMin: number;
  allowAutoSearch: boolean;
}

interface TimeSlot {
  start: Date;
  end: Date;
}

// --- LOCALIZATION ---
const TRANSLATIONS = {
  en: {
    app_name: "TimeAgree",
    login_welcome: "Welcome to TimeAgree!",
    login_desc: "Log in with Telegram to sync your availability with your groups.",
    logout: "Logout",
    upgrade: "UPGRADE",
    my_slots: "My Slots",
    find_time: "Find Time",
    settings: "Settings",
    my_busy_slots: "BUSY SLOTS FOR",
    free_bird: "No busy slots for this day.",
    weekly: "Weekly",
    one_time: "One-time",
    weekly_btn: "Weekly",
    one_time_btn: "One Time",
    i_am_busy: "I am busy...",
    save_availability: "Save Availability",
    day_of_week: "Days of Week",
    date: "Date",
    from: "From",
    to: "To",
    all_day: "All Day",
    description: "Note (optional)",
    find_magic_slot: "Find Magic Slot",
    calculating: "Calculating intersections...",
    no_common_time: "No common time found.",
    everyone_busy: "Everyone is too busy.",
    top_results: "Top Results",
    reset: "Reset",
    duration: "duration",
    leave_group: "Leave Group",
    timezone: "Timezone",
    invite_friends: "Invite Friends",
    share: "Share to Chat",
    create_group: "Create New Group",
    switch_group_title: "My Groups",
    no_groups: "No Groups Yet",
    no_groups_desc: "Add the bot to a Telegram group to get started!",
    add_to_group_btn: "Add Bot to Group"
  },
  ru: {
    app_name: "TimeAgree",
    login_welcome: "Добро пожаловать!",
    login_desc: "Авторизуйтесь через Telegram, чтобы синхронизировать свои слоты с группами.",
    logout: "Выйти",
    upgrade: "PREMIUM",
    my_slots: "Мои слоты",
    find_time: "Поиск",
    settings: "Настройки",
    my_busy_slots: "ЗАНЯТОСТЬ НА",
    free_bird: "В этот день вы свободны.",
    weekly: "Еженедельно",
    one_time: "Разово",
    weekly_btn: "Каждую неделю",
    one_time_btn: "Один раз",
    i_am_busy: "Я занят...",
    save_availability: "Сохранить",
    day_of_week: "Дни недели",
    date: "Дата",
    from: "С",
    to: "До",
    all_day: "Весь день",
    description: "Заметка (необязательно)",
    find_magic_slot: "Найти время",
    calculating: "Ищем пересечения...",
    no_common_time: "Общее время не найдено.",
    everyone_busy: "Слишком плотные графики.",
    top_results: "Лучшие варианты",
    reset: "Сброс",
    duration: "длительность",
    leave_group: "Покинуть группу",
    timezone: "Часовой пояс",
    invite_friends: "Пригласить друзей",
    share: "Отправить в чат",
    create_group: "Создать новую группу",
    switch_group_title: "Мои группы",
    no_groups: "Нет групп",
    no_groups_desc: "Добавьте бота в группу Telegram, чтобы начать!",
    add_to_group_btn: "Добавить бота в группу"
  }
};

const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: { maxMembers: 7, searchWindowDays: 7, minSlotDurationMin: 30, allowAutoSearch: false },
  GROUP_PRO: { maxMembers: 50, searchWindowDays: 30, minSlotDurationMin: 15, allowAutoSearch: true },
  BUSINESS: { maxMembers: 200, searchWindowDays: 60, minSlotDurationMin: 15, allowAutoSearch: true }
};

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// --- STATE MANAGEMENT ---

interface AppState {
  user: User;
  group: Group | null;
  userGroups: { id: number, title: string }[];
  allSlots: BusySlot[];
  mySlots: BusySlot[];
  lang: LangCode;
  isLoading: boolean;
  isAuthRequired: boolean;
  error: string | null;
  logs: string[];
  t: (key: string, ...args: any[]) => string;
  addSlot: (slot: Partial<BusySlot>) => void;
  removeSlot: (id: string) => void;
  refreshData: () => void;
  createNewGroup: () => void;
  switchGroup: (groupId: number) => void;
  leaveGroup: (groupId: number) => void;
  forceGroupLoad: (groupId: number) => Promise<void>;
  onAuthSuccess: (user: any) => void;
  logout: () => void;
}

const AppContext = createContext<AppState | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<{ id: number, title: string }[]>([]);
  const [allSlots, setAllSlots] = useState<BusySlot[]>([]);
  const [lang, setLang] = useState<LangCode>('ru');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
      console.log(msg);
      setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async (externalUser?: any) => {
    try {
      addLog("Initializing...");
      setIsLoading(true);

      let tgUserRaw = externalUser || window.Telegram?.WebApp?.initDataUnsafe?.user;

      // Если нет данных от WebApp, проверяем localStorage
      if (!tgUserRaw) {
        const saved = localStorage.getItem('tg_user_session');
        if (saved) {
            tgUserRaw = JSON.parse(saved);
            addLog("Session restored from local storage.");
        }
      }

      if (!tgUserRaw) {
        addLog("No user detected. Auth required.");
        setIsAuthRequired(true);
        setIsLoading(false);
        return;
      }

      setIsAuthRequired(false);
      setLang(tgUserRaw.language_code?.startsWith('ru') ? 'ru' : 'en');

      const currentUser: User = {
        id: tgUserRaw.id,
        username: tgUserRaw.username || '',
        firstName: tgUserRaw.first_name || tgUserRaw.firstName || 'User',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languageCode: tgUserRaw.language_code,
        photoUrl: tgUserRaw.photo_url
      };

      // Sync with Supabase
      const { error: userError } = await supabase.from('users').upsert({
        id: currentUser.id,
        username: currentUser.username,
        first_name: currentUser.firstName,
        timezone: currentUser.timezone
      });
      
      if (userError) throw new Error(`DB Sync Error: ${userError.message}`);
      
      setUser(currentUser);
      localStorage.setItem('tg_user_session', JSON.stringify(tgUserRaw));

      // Handle Group from URL
      const urlParams = new URLSearchParams(window.location.search);
      let targetGroupId: number | null = null;
      const qGid = urlParams.get('gid');
      if (qGid) {
          targetGroupId = parseInt(qGid);
          await supabase.from('group_members').upsert({ group_id: targetGroupId, user_id: currentUser.id }, { onConflict: 'group_id, user_id' });
      } else {
          // Check for startapp
          const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
          if (startParam?.startsWith('gid_')) targetGroupId = parseInt(startParam.split('_')[1]);
      }

      await fetchUserGroups(currentUser.id);

      if (!targetGroupId) {
          const { data } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id).limit(1);
          if (data && data.length > 0) targetGroupId = data[0].group_id;
      }

      if (targetGroupId) await loadGroupData(targetGroupId);
      else setIsLoading(false);

    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  const fetchUserGroups = async (userId: number) => {
      const { data } = await supabase.from('group_members').select('group_id, groups(id, title)').eq('user_id', userId);
      const list = data?.map((r: any) => ({ id: r.groups.id, title: r.groups.title })).filter((g: any) => g.id && g.title) || [];
      setUserGroups(list);
  };

  const loadGroupData = async (groupId: number) => {
    setIsLoading(true);
    const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (!groupData) { setIsLoading(false); return; }

    const { data: membersData } = await supabase.from('group_members').select('user_id, users(id, username, first_name, timezone)').eq('group_id', groupId);
    const members: User[] = membersData?.map((m: any) => ({
        id: m.users.id, username: m.users.username, firstName: m.users.first_name, timezone: m.users.timezone
    })) || [];

    setGroup({ id: groupData.id, title: groupData.title, tier: groupData.tier as PlanTier, members: members });
    await fetchSlots(groupId);
    setIsLoading(false);
  };

  const fetchSlots = async (groupId: number) => {
    const { data } = await supabase.from('slots').select('*').eq('group_id', groupId);
    if (data) {
        setAllSlots(data.map((s: any) => ({
            id: s.id, userId: s.user_id, groupId: s.group_id, type: s.type, description: s.description,
            startAt: s.start_at, endAt: s.end_at, dayOfWeek: s.day_of_week,
            startTimeLocal: s.start_time_local?.slice(0,5), endTimeLocal: s.end_time_local?.slice(0,5)
        })));
    }
  };

  const onAuthSuccess = (tgUser: any) => {
      addLog("Login Success!");
      initApp(tgUser);
  };

  const logout = () => {
      localStorage.removeItem('tg_user_session');
      window.location.reload();
  };

  const addSlot = async (slot: Partial<BusySlot>) => {
    if (!user || !group) return;
    await supabase.from('slots').insert({
        user_id: user.id, group_id: group.id, type: slot.type, description: slot.description,
        start_at: slot.startAt || null, end_at: slot.endAt || null,
        day_of_week: slot.dayOfWeek, start_time_local: slot.startTimeLocal, end_time_local: slot.endTimeLocal
    });
  };

  const removeSlot = async (id: string) => { await supabase.from('slots').delete().eq('id', id); };
  const switchGroup = async (groupId: number) => { await loadGroupData(groupId); };
  const leaveGroup = async (groupId: number) => {
      if (!user || !confirm('Leave group?')) return;
      await supabase.from('group_members').delete().match({ group_id: groupId, user_id: user.id });
      window.location.reload();
  };

  const t = (key: string, ...args: any[]) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    const val = dict[key as keyof typeof dict];
    if (typeof val === 'function') return (val as any)(...args);
    return val || key;
  };

  const mySlots = useMemo(() => user ? allSlots.filter(s => s.userId === user.id) : [], [allSlots, user]);

  return (
    <AppContext.Provider value={{ 
        user: user!, group, userGroups, allSlots, mySlots, lang, isLoading, isAuthRequired, error, logs,
        t, addSlot, removeSlot, refreshData: () => group && fetchSlots(group.id), 
        createNewGroup: () => {}, switchGroup, leaveGroup, forceGroupLoad: async () => {},
        onAuthSuccess, logout
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- AUTH SCREEN ---

const LoginScreen = () => {
    const { onAuthSuccess, t, lang } = useContext(AppContext)!;
    
    useEffect(() => {
        // Динамически вставляем виджет Telegram
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', BOT_USERNAME);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '12');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        
        // Глобальный коллбэк для виджета
        (window as any).onTelegramAuth = (user: any) => {
            onAuthSuccess(user);
        };
        
        document.getElementById('tg-login-container')?.appendChild(script);
        return () => { delete (window as any).onTelegramAuth; };
    }, []);

    return (
        <div className="min-h-screen bg-[#18181b] flex flex-col items-center justify-center p-6 text-center text-white">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                <i className="fa-brands fa-telegram text-4xl"></i>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('login_welcome')}</h1>
            <p className="text-gray-400 mb-10 text-sm max-w-xs">{t('login_desc')}</p>
            <div id="tg-login-container" className="min-h-[50px]"></div>
            <p className="mt-12 text-[10px] text-gray-600 uppercase tracking-widest font-bold">Secure via Telegram Auth</p>
        </div>
    );
};

// --- MAIN UI COMPONENTS ---

const Header = () => {
    const { group, userGroups, switchGroup, t } = useContext(AppContext)!;
    const [isMenuOpen, setMenuOpen] = useState(false);
    if (!group) return null;
    return (
        <div className="relative z-50">
            <div className="bg-[#27272a] p-4 flex justify-between items-center shadow-md relative z-20">
                <div onClick={() => setMenuOpen(!isMenuOpen)} className="flex items-center gap-2 cursor-pointer active:opacity-70 max-w-[70%]">
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2 truncate">
                            <span className="truncate">{group.title}</span> 
                            <i className={`fa-solid fa-chevron-down text-xs transition ${isMenuOpen ? 'rotate-180' : ''}`}></i>
                        </h1>
                        <p className="text-xs text-gray-400">{group.members.length} уч.</p>
                    </div>
                </div>
            </div>
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 bg-[#27272a] border-t border-gray-700 shadow-2xl z-20 rounded-b-xl overflow-hidden slide-in">
                        <div className="p-3 bg-black/20 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('switch_group_title')}</div>
                        {userGroups.map(g => (
                            <button key={g.id} onClick={() => { switchGroup(g.id); setMenuOpen(false); }} className={`w-full text-left p-4 border-b border-gray-800 flex justify-between items-center ${g.id === group.id ? 'bg-[#3b82f6]/10 text-blue-400' : 'text-white'}`}>
                                <span className="font-medium truncate">{g.title}</span>
                                {g.id === group.id && <i className="fa-solid fa-check text-blue-500"></i>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

const TabBar = ({ active, setTab }: { active: string, setTab: (t: string) => void }) => {
  const { t } = useContext(AppContext)!;
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#27272a] border-t border-gray-700 flex justify-around p-2 pb-6 ios-safe-area-bottom z-50">
      <TabButton icon="fa-calendar-check" label={t('my_slots')} active={active === 'slots'} onClick={() => setTab('slots')} />
      <TabButton icon="fa-magnifying-glass" label={t('find_time')} active={active === 'search'} onClick={() => setTab('search')} />
      <TabButton icon="fa-gear" label={t('settings')} active={active === 'settings'} onClick={() => setTab('settings')} />
    </div>
  );
};
const TabButton = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-1/3 ${active ? 'text-[#3b82f6]' : 'text-gray-500'}`}><i className={`fa-solid ${icon} text-xl`}></i><span className="text-[10px]">{label}</span></button>
);

const SlotCard: React.FC<{ slot: BusySlot; onDelete: () => void }> = ({ slot, onDelete }) => {
    const { t, lang } = useContext(AppContext)!;
    const isCyclic = slot.type === 'CYCLIC_WEEKLY';
    const days = lang === 'ru' ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
        <div className="bg-[#27272a] p-3 rounded-lg mb-2 flex justify-between items-center border-l-4 border-red-500 slide-in">
            <div>
                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{isCyclic ? t('weekly') : t('one_time')}</span></div>
                <div className="text-xs text-gray-400">{isCyclic ? `${days[slot.dayOfWeek!]} • ${slot.startTimeLocal} - ${slot.endTimeLocal}` : `${new Date(slot.startAt!).toLocaleDateString(lang)} • ${new Date(slot.startAt!).toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}`}</div>
            </div>
            <button onClick={onDelete} className="text-red-400 p-2"><i className="fa-solid fa-trash"></i></button>
        </div>
    )
}

const MiniCalendar = ({ mySlots, selectedDate, onSelectDate }: { mySlots: BusySlot[], selectedDate: Date, onSelectDate: (d: Date) => void }) => {
    const { lang } = useContext(AppContext)!;
    const [viewDate, setViewDate] = useState(new Date());
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const daysLabels = lang === 'ru' ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
    return (
        <div className="bg-[#27272a] rounded-xl p-4 mb-4 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => {const d = new Date(viewDate); d.setMonth(d.getMonth()-1); setViewDate(d);}} className="p-2 text-gray-400"><i className="fa-solid fa-chevron-left"></i></button>
                <h3 className="font-bold text-lg capitalize">{viewDate.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => {const d = new Date(viewDate); d.setMonth(d.getMonth()+1); setViewDate(d);}} className="p-2 text-gray-400"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="grid grid-cols-7 mb-2 text-center">{daysLabels.map((d, i) => <div key={i} className="text-xs text-gray-500 font-bold">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                    const dayOfWeek = d.getDay();
                    const dateStr = d.toISOString().split('T')[0];
                    const isBusy = mySlots.some(s => (s.type === 'CYCLIC_WEEKLY' && s.dayOfWeek === dayOfWeek) || (s.type === 'ONE_TIME' && s.startAt?.startsWith(dateStr)));
                    return ( <button key={day} onClick={() => onSelectDate(d)} className={`h-10 w-full rounded-xl flex items-center justify-center relative ${isSelected ? 'bg-blue-500 text-white' : isBusy ? 'bg-red-500/10 text-red-200 border border-red-500/20' : 'text-gray-400'}`}><span className="text-sm">{day}</span></button> );
                })}
            </div>
        </div>
    );
};

const AddSlotModal = ({ isOpen, onClose, initialDate }: { isOpen: boolean, onClose: () => void, initialDate: Date }) => {
    const { addSlot, t, lang } = useContext(AppContext)!;
    const [type, setType] = useState<SlotType>('ONE_TIME');
    const [start, setStart] = useState("09:00");
    const [end, setEnd] = useState("18:00");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    useEffect(() => {
        if(isOpen && initialDate) {
            const offset = initialDate.getTimezoneOffset();
            const adjDate = new Date(initialDate.getTime() - (offset*60*1000));
            setDate(adjDate.toISOString().split('T')[0]);
        }
    }, [isOpen, initialDate]);
    if (!isOpen) return null;
    const handleSave = async () => {
        if (type === 'CYCLIC_WEEKLY') await addSlot({ type, dayOfWeek: initialDate.getDay(), startTimeLocal: start, endTimeLocal: end });
        else {
            const startD = new Date(`${date}T${start}:00`);
            const endD = new Date(`${date}T${end}:00`);
            await addSlot({ type, startAt: startD.toISOString(), endAt: endD.toISOString(), startTimeLocal: start, endTimeLocal: end });
        }
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end justify-center">
            <div className="bg-[#18181b] w-full max-w-md rounded-t-2xl p-6 pb-10 slide-in">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{t('i_am_busy')}</h2><button onClick={onClose} className="text-gray-400 p-2"><i className="fa-solid fa-xmark"></i></button></div>
                <div className="flex bg-[#27272a] p-1 rounded-lg mb-6">
                    <button onClick={() => setType('ONE_TIME')} className={`flex-1 py-2 text-sm rounded-md ${type === 'ONE_TIME' ? 'bg-[#3b82f6]' : 'text-gray-400'}`}>{t('one_time_btn')}</button>
                    <button onClick={() => setType('CYCLIC_WEEKLY')} className={`flex-1 py-2 text-sm rounded-md ${type === 'CYCLIC_WEEKLY' ? 'bg-[#3b82f6]' : 'text-gray-400'}`}>{t('weekly_btn')}</button>
                </div>
                <div className="space-y-4 mb-8">
                    {type === 'ONE_TIME' && <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white" />}
                    <div className="flex gap-4">
                        <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">{t('from')}</label><input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white" /></div>
                        <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">{t('to')}</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white" /></div>
                    </div>
                </div>
                <button onClick={handleSave} className="w-full bg-[#3b82f6] text-white py-4 rounded-xl font-bold">{t('save_availability')}</button>
            </div>
        </div>
    );
};

const MySlotsScreen = () => {
    const { mySlots, removeSlot, t, lang } = useContext(AppContext)!;
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isModalOpen, setModalOpen] = useState(false);
    const dailySlots = mySlots.filter(s => (s.type === 'CYCLIC_WEEKLY' && s.dayOfWeek === selectedDate.getDay()) || (s.type === 'ONE_TIME' && s.startAt?.startsWith(selectedDate.toISOString().split('T')[0])));
    return (
        <div className="p-4 pb-24">
            <MiniCalendar mySlots={mySlots} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{t('my_busy_slots')} {selectedDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}</h2>
            {dailySlots.length === 0 ? <div className="text-center py-10 opacity-30 text-sm">{t('free_bird')}</div> : dailySlots.map(s => <SlotCard key={s.id} slot={s} onDelete={() => removeSlot(s.id)} />)}
            <button onClick={() => setModalOpen(true)} className="fixed bottom-24 right-4 bg-[#3b82f6] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"><i className="fa-solid fa-plus text-xl"></i></button>
            <AddSlotModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} initialDate={selectedDate} />
        </div>
    );
};

const SearchScreen = () => {
    const { group, allSlots, t, lang } = useContext(AppContext)!;
    const [results, setResults] = useState<{ start: Date, end: Date, durationMinutes: number }[] | null>(null);
    const [loading, setLoading] = useState(false);
    if (!group) return null;
    const handleSearch = () => { setLoading(true); setTimeout(() => { setResults(TimeFinderService.findCommonFreeTime(group, allSlots, group.members.map(m => m.id))); setLoading(false); }, 1000); };
    return (
        <div className="p-4 pb-24 text-center">
            {!results && !loading && <div className="py-20"><h2 className="text-xl font-bold mb-4">{t('find_time')}</h2><p className="text-gray-400 text-sm mb-8">Ищем пересечения для всех участников на 7 дней.</p><button onClick={handleSearch} className="bg-white text-black px-10 py-4 rounded-full font-bold">{t('find_magic_slot')}</button></div>}
            {loading && <div className="py-20"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-500 mb-4"></i><p className="text-gray-400">{t('calculating')}</p></div>}
            {results && (
                <div className="text-left">
                    <div className="flex justify-between items-center mb-6"><h2 className="font-bold">{t('top_results')}</h2><button onClick={() => setResults(null)} className="text-blue-500 text-sm">{t('reset')}</button></div>
                    {results.length === 0 ? <p className="text-red-400">{t('no_common_time')}</p> : results.slice(0,5).map((r, i) => (
                        <div key={i} className="bg-[#27272a] p-4 rounded-xl mb-3 border-l-4 border-green-500">
                            <div className="font-bold text-lg">{r.start.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})} - {r.end.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}</div>
                            <div className="text-xs text-gray-500">{r.start.toLocaleDateString(lang, {weekday: 'long', day: 'numeric', month: 'short'})}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SettingsScreen = () => {
    const { user, group, t, logout, leaveGroup } = useContext(AppContext)!;
    if (!group) return null;
    return (
        <div className="p-4 space-y-4">
            <div className="bg-[#27272a] p-6 rounded-2xl flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full mb-3 flex items-center justify-center overflow-hidden">
                    {user.photoUrl ? <img src={user.photoUrl} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user text-2xl"></i>}
                </div>
                <h2 className="font-bold text-lg">{user.firstName}</h2>
                <p className="text-xs text-gray-500">@{user.username}</p>
            </div>
            <button onClick={() => leaveGroup(group.id)} className="w-full p-4 bg-red-500/10 text-red-500 rounded-xl font-bold">{t('leave_group')}</button>
            <button onClick={logout} className="w-full p-4 bg-[#27272a] text-gray-400 rounded-xl font-bold">{t('logout')}</button>
        </div>
    );
};

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('slots');
  const { isLoading, isAuthRequired, group, error } = useContext(AppContext)!;
  if (error) return <div className="min-h-screen bg-[#18181b] p-10 text-red-400">{error}</div>;
  if (isAuthRequired) return <LoginScreen />;
  if (isLoading) return <div className="min-h-screen bg-[#18181b] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i></div>;
  if (!group) return <EmptyStateScreen />;
  return (
    <div className="min-h-screen bg-[#18181b] text-white">
      <Header />
      <main>{activeTab === 'slots' ? <MySlotsScreen /> : activeTab === 'search' ? <SearchScreen /> : <SettingsScreen />}</main>
      <TabBar active={activeTab} setTab={setActiveTab} />
    </div>
  );
};

const EmptyStateScreen = () => {
    const { t } = useContext(AppContext)!;
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center">
            <h1 className="text-xl font-bold mb-4">{t('no_groups')}</h1>
            <p className="text-gray-400 text-sm mb-10">{t('no_groups_desc')}</p>
            <button onClick={() => window.open(`https://t.me/${BOT_USERNAME}?startgroup=true`, '_blank')} className="w-full bg-blue-500 text-white py-4 rounded-xl font-bold">{t('add_to_group_btn')}</button>
        </div>
    )
}

const App = () => {
    useEffect(() => { if (window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); } }, []);
    return <AppProvider><AppContent /></AppProvider>;
};

// --- ALGORITHM RE-IMPLEMENTATION ---
class TimeFinderService {
  static findCommonFreeTime(group: Group, slots: BusySlot[], memberIdsToInclude: number[]) {
    const config = PLAN_CONFIGS[group.tier];
    const windowStart = new Date(); windowStart.setHours(0,0,0,0);
    const windowEnd = new Date(windowStart); windowEnd.setDate(windowEnd.getDate() + config.searchWindowDays);

    const userFreeIntervals: Record<number, TimeSlot[]> = {};
    group.members.forEach(m => {
        if (!memberIdsToInclude.includes(m.id)) return;
        const busy: TimeSlot[] = [];
        slots.filter(s => s.userId === m.id).forEach(s => {
            if (s.type === 'ONE_TIME' && s.startAt && s.endAt) busy.push({ start: new Date(s.startAt), end: new Date(s.endAt) });
            else if (s.type === 'CYCLIC_WEEKLY' && s.dayOfWeek !== undefined) {
                let curr = new Date(windowStart);
                while(curr < windowEnd) {
                    if (curr.getDay() === s.dayOfWeek) {
                        const [sh, sm] = s.startTimeLocal!.split(':').map(Number);
                        const [eh, em] = s.endTimeLocal!.split(':').map(Number);
                        const start = new Date(curr); start.setHours(sh, sm, 0, 0);
                        const end = new Date(curr); end.setHours(eh, em, 0, 0);
                        busy.push({ start, end });
                    }
                    curr.setDate(curr.getDate()+1);
                }
            }
        });
        userFreeIntervals[m.id] = this.invertIntervals(this.mergeIntervals(busy), windowStart, windowEnd);
    });

    let common = userFreeIntervals[memberIdsToInclude[0]] || [];
    for (let i = 1; i < memberIdsToInclude.length; i++) {
        common = this.intersectIntervalLists(common, userFreeIntervals[memberIdsToInclude[i]] || []);
    }
    return common.map(s => ({ ...s, durationMinutes: (s.end.getTime() - s.start.getTime()) / 60000 })).filter(s => s.durationMinutes >= config.minSlotDurationMin);
  }

  private static mergeIntervals(intervals: TimeSlot[]): TimeSlot[] {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = intervals[i];
      if (curr.start <= prev.end) prev.end = new Date(Math.max(prev.end.getTime(), curr.end.getTime()));
      else merged.push(curr);
    }
    return merged;
  }
  private static invertIntervals(busy: TimeSlot[], start: Date, end: Date): TimeSlot[] {
    const free: TimeSlot[] = [];
    let pointer = new Date(start);
    for (const slot of busy) {
      if (slot.start > pointer) free.push({ start: new Date(pointer), end: new Date(slot.start) });
      pointer = new Date(Math.max(pointer.getTime(), slot.end.getTime()));
    }
    if (pointer < end) free.push({ start: new Date(pointer), end: new Date(end) });
    return free;
  }
  private static intersectIntervalLists(l1: TimeSlot[], l2: TimeSlot[]): TimeSlot[] {
    const result: TimeSlot[] = [];
    let i = 0, j = 0;
    while (i < l1.length && j < l2.length) {
      const s = new Date(Math.max(l1[i].start.getTime(), l2[j].start.getTime()));
      const e = new Date(Math.min(l1[i].end.getTime(), l2[j].end.getTime()));
      if (s < e) result.push({ start: s, end: e });
      if (l1[i].end < l2[j].end) i++; else j++;
    }
    return result;
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

declare global { interface Window { Telegram: any; } }
