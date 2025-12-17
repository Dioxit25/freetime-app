import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_KEY;
const BOT_USERNAME = 'TimeAgreeBot'; // Updated to match your bot

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
    upgrade: "UPGRADE",
    my_slots: "My Slots",
    find_time: "Find Time",
    settings: "Settings",
    keep_updated: "Keep it updated!",
    keep_updated_desc: "Colored days indicate busy slots.",
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
    pro_upsell: "Upgrade to Pro to see 30 days ahead.",
    leave_group: "Leave Group",
    you: "(You)",
    timezone: "Timezone",
    my_name: "My Name",
    group_label: "CURRENT GROUP",
    algo_desc: (count: number, days: number) => `Checking availability for ${count} selected members over next ${days} days.`,
    invite_friends: "Invite Friends",
    invite_desc: "Share link to add members:",
    link_copied: "Link copied!",
    copy: "Copy Link",
    share: "Share to Chat",
    create_group: "Create New Group",
    switching_group: "Switch Group",
    select_members: "Select Participants",
    select_all: "Select All",
    switch_group_title: "My Groups",
    current: "Current",
    confirm_leave: "Are you sure you want to leave this group?",
    no_groups: "No Groups Yet",
    no_groups_desc: "Add the bot to a Telegram group to get started!",
    add_to_group_btn: "Add Bot to Group"
  },
  ru: {
    app_name: "TimeAgree",
    upgrade: "PREMIUM",
    my_slots: "Мои слоты",
    find_time: "Поиск",
    settings: "Настройки",
    keep_updated: "Ваш календарь",
    keep_updated_desc: "Цветные дни — заняты. Нажмите для деталей.",
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
    pro_upsell: "Купите Pro, чтобы искать на 30 дней вперед.",
    leave_group: "Покинуть группу",
    you: "(Вы)",
    timezone: "Часовой пояс",
    my_name: "Мое имя",
    group_label: "ТЕКУЩАЯ ГРУППА",
    algo_desc: (count: number, days: number) => `Проверка доступности ${count} участников на ближайшие ${days} дн.`,
    invite_friends: "Пригласить друзей",
    invite_desc: "Отправьте ссылку участникам:",
    link_copied: "Ссылка скопирована!",
    copy: "Копировать",
    share: "Отправить в чат",
    create_group: "Создать новую группу",
    switching_group: "Сменить группу",
    select_members: "Участники встречи",
    select_all: "Выбрать всех",
    switch_group_title: "Мои группы",
    current: "Текущая",
    confirm_leave: "Вы уверены, что хотите покинуть эту группу?",
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

// --- ALGORITHM SERVICE ---
class TimeFinderService {
  static findCommonFreeTime(group: Group, slots: BusySlot[], memberIdsToInclude: number[], searchStartDate: Date = new Date()) {
    const config = PLAN_CONFIGS[group.tier];
    const windowStart = new Date(searchStartDate);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + config.searchWindowDays);

    const activeMembers = group.members.filter(m => memberIdsToInclude.includes(m.id));
    if (activeMembers.length === 0) return [];

    const userBusyIntervals: Record<number, TimeSlot[]> = {};
    activeMembers.forEach(m => userBusyIntervals[m.id] = []);

    slots.forEach(slot => {
      if (!memberIdsToInclude.includes(slot.userId)) return;
      if (!userBusyIntervals[slot.userId]) return;

      if (slot.type === 'ONE_TIME' && slot.startAt && slot.endAt) {
        userBusyIntervals[slot.userId].push({ start: new Date(slot.startAt), end: new Date(slot.endAt) });
      } else if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined && slot.startTimeLocal && slot.endTimeLocal) {
        userBusyIntervals[slot.userId].push(...this.expandCyclicSlot(slot, windowStart, windowEnd));
      }
    });

    Object.keys(userBusyIntervals).forEach(key => {
      const uid = parseInt(key);
      userBusyIntervals[uid] = this.mergeIntervals(userBusyIntervals[uid]);
    });

    const userFreeIntervals: Record<number, TimeSlot[]> = {};
    Object.keys(userBusyIntervals).forEach(key => {
      const uid = parseInt(key);
      userFreeIntervals[uid] = this.invertIntervals(userBusyIntervals[uid], windowStart, windowEnd);
    });

    const firstUserId = activeMembers[0].id;
    let commonFreeTime = userFreeIntervals[firstUserId] || [];
    for (let i = 1; i < activeMembers.length; i++) {
        commonFreeTime = this.intersectIntervalLists(commonFreeTime, userFreeIntervals[activeMembers[i].id] || []);
    }

    return commonFreeTime
      .map(slot => ({ ...slot, durationMinutes: (slot.end.getTime() - slot.start.getTime()) / (1000 * 60) }))
      .filter(slot => slot.durationMinutes >= config.minSlotDurationMin)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private static expandCyclicSlot(slot: BusySlot, windowStart: Date, windowEnd: Date): TimeSlot[] {
    const result: TimeSlot[] = [];
    let current = new Date(windowStart);
    current.setHours(0,0,0,0);
    while (current < windowEnd) {
      if (current.getDay() === slot.dayOfWeek) {
        const [startH, startM] = (slot.startTimeLocal || "00:00").split(':').map(Number);
        const [endH, endM] = (slot.endTimeLocal || "23:59").split(':').map(Number);
        const start = new Date(current); start.setHours(startH, startM, 0, 0);
        const end = new Date(current); end.setHours(endH, endM, 0, 0);
        if (end < start) end.setDate(end.getDate() + 1);
        result.push({ start, end });
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  }
  private static mergeIntervals(intervals: TimeSlot[]): TimeSlot[] {
    if (!intervals.length) return [];
    intervals.sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged: TimeSlot[] = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = intervals[i];
      if (curr.start <= prev.end) prev.end = new Date(Math.max(prev.end.getTime(), curr.end.getTime()));
      else merged.push(curr);
    }
    return merged;
  }
  private static invertIntervals(busy: TimeSlot[], windowStart: Date, windowEnd: Date): TimeSlot[] {
    const free: TimeSlot[] = [];
    let pointer = new Date(windowStart);
    for (const slot of busy) {
      if (slot.start > pointer) free.push({ start: new Date(pointer), end: new Date(slot.start) });
      pointer = new Date(Math.max(pointer.getTime(), slot.end.getTime()));
    }
    if (pointer < windowEnd) free.push({ start: new Date(pointer), end: new Date(windowEnd) });
    return free;
  }
  private static intersectIntervalLists(listA: TimeSlot[], listB: TimeSlot[]): TimeSlot[] {
    const intersections: TimeSlot[] = [];
    let i = 0, j = 0;
    while (i < listA.length && j < listB.length) {
      const a = listA[i], b = listB[j];
      const startMax = new Date(Math.max(a.start.getTime(), b.start.getTime()));
      const endMin = new Date(Math.min(a.end.getTime(), b.end.getTime()));
      if (startMax < endMin) intersections.push({ start: startMax, end: endMin });
      if (a.end < b.end) i++; else j++;
    }
    return intersections;
  }
}

// --- STATE MANAGEMENT ---

interface AppState {
  user: User;
  group: Group | null;
  userGroups: { id: number, title: string }[];
  allSlots: BusySlot[];
  mySlots: BusySlot[];
  lang: LangCode;
  isLoading: boolean;
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
}

const AppContext = createContext<AppState | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [userGroups, setUserGroups] = useState<{ id: number, title: string }[]>([]);
  const [allSlots, setAllSlots] = useState<BusySlot[]>([]);
  const [lang, setLang] = useState<LangCode>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
      console.log(msg);
      setLogs(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        addLog("Initializing App...");
        
        let tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        if (!tgUser) {
          addLog("WARN: TG User not found. Using Mock.");
          tgUser = { id: 101, first_name: "DevUser", username: "dev_alex", language_code: "en" };
        } else {
          addLog(`User: ${tgUser.id} (${tgUser.first_name})`);
        }

        setLang(tgUser.language_code?.startsWith('ru') ? 'ru' : 'en');

        // Upsert User
        const { error: userError } = await supabase.from('users').upsert({
          id: tgUser.id,
          username: tgUser.username,
          first_name: tgUser.first_name,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        if (userError) throw new Error(`User Sync Error: ${userError.message}`);

        const currentUser: User = {
          id: tgUser.id,
          username: tgUser.username || '',
          firstName: tgUser.first_name || 'User',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          languageCode: tgUser.language_code
        };
        setUser(currentUser);

        // --- PARAM PARSING ---
        let startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
        
        // Check hash first (for web_app buttons with hash)
        const hash = window.location.hash;
        if (!startParam && hash) {
            addLog(`Checking hash: ${hash}`);
            if (hash.includes('gid=')) {
                startParam = `gid_${hash.split('gid=')[1].split('&')[0]}`;
            } else if (hash.startsWith('#gid_')) {
                startParam = hash.substring(1);
            }
        }

        // Check query (for web_app buttons with query)
        if (!startParam) {
            const urlParams = new URLSearchParams(window.location.search);
            startParam = urlParams.get('startapp') || urlParams.get('gid');
            if (urlParams.get('gid') && !startParam?.startsWith('gid_')) {
                startParam = `gid_${urlParams.get('gid')}`;
            }
        }

        addLog(`Final Param: ${startParam || 'None'}`);

        let targetGroupId: number | null = null;

        if (startParam && startParam.startsWith('gid_')) {
            const idStr = startParam.split('_')[1];
            const inviteId = parseInt(idStr);
            if (!isNaN(inviteId)) {
                await supabase.from('group_members').upsert({ group_id: inviteId, user_id: currentUser.id }, { onConflict: 'group_id, user_id' });
                targetGroupId = inviteId;
            }
        }

        await fetchUserGroups(currentUser.id);

        if (!targetGroupId) {
            const { data: membersData } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
            if (membersData && membersData.length > 0) targetGroupId = membersData[0].group_id;
        }

        if (targetGroupId) await loadGroupData(targetGroupId);
        else setIsLoading(false);

      } catch (e: any) {
        setError(e.message);
        addLog(`CRITICAL: ${e.message}`);
        setIsLoading(false);
      }
    };

    if (!SUPABASE_URL || !SUPABASE_KEY) setError("Supabase credentials missing.");
    else initApp();
  }, []);

  const fetchUserGroups = async (userId: number) => {
      const { data } = await supabase.from('group_members').select('group_id, groups(id, title)').eq('user_id', userId);
      const list = data?.map((r: any) => ({ id: r.groups.id, title: r.groups.title })).filter((g: any) => g.id && g.title) || [];
      setUserGroups(list);
  };

  const loadGroupData = async (groupId: number) => {
    setIsLoading(true);
    addLog(`Loading Group ${groupId}...`);
    const { data: groupData, error: gErr } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (gErr || !groupData) { setIsLoading(false); return; }

    const { data: membersData } = await supabase.from('group_members').select('user_id, users(id, username, first_name, timezone)').eq('group_id', groupId);
    const members: User[] = membersData?.map((m: any) => ({
        id: m.users.id, username: m.users.username, firstName: m.users.first_name, timezone: m.users.timezone
    })) || [];

    setGroup({ id: groupData.id, title: groupData.title, tier: groupData.tier as PlanTier, members: members });
    await fetchSlots(groupId);
    setIsLoading(false);
  };

  const forceGroupLoad = async (groupId: number) => {
      if (!user) return;
      await supabase.from('group_members').upsert({ group_id: groupId, user_id: user.id }, { onConflict: 'group_id, user_id' });
      await fetchUserGroups(user.id);
      await loadGroupData(groupId);
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

  const createNewGroup = async () => {
      if(!user) return;
      const title = prompt("Enter group name (Personal):");
      if(!title) return;
      const manualId = Math.floor(Math.random() * 100000000) + 10000;
      const { error } = await supabase.from('groups').insert({ id: manualId, title, tier: "FREE" });
      if(!error) {
          await supabase.from('group_members').insert({ group_id: manualId, user_id: user.id });
          await fetchUserGroups(user.id);
          await loadGroupData(manualId);
      }
  };

  const switchGroup = async (groupId: number) => { await loadGroupData(groupId); };
  const leaveGroup = async (groupId: number) => {
      if (!user || !confirm('Leave this group?')) return;
      await supabase.from('group_members').delete().match({ group_id: groupId, user_id: user.id });
      await fetchUserGroups(user.id);
      const remaining = userGroups.filter(g => g.id !== groupId);
      if (remaining.length > 0) switchGroup(remaining[0].id); else setGroup(null);
  };

  useEffect(() => {
    if (!group) return;
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `group_id=eq.${group.id}` }, () => fetchSlots(group.id)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group]);

  const addSlot = async (slot: Partial<BusySlot>) => {
    if (!user || !group) return;
    await supabase.from('slots').insert({
        user_id: user.id, group_id: group.id, type: slot.type, description: slot.description,
        start_at: slot.startAt || null, end_at: slot.endAt || null,
        day_of_week: slot.dayOfWeek, start_time_local: slot.startTimeLocal, end_time_local: slot.endTimeLocal
    });
  };

  const removeSlot = async (id: string) => { await supabase.from('slots').delete().eq('id', id); };
  
  const t = (key: string, ...args: any[]) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    const val = dict[key as keyof typeof dict];
    if (typeof val === 'function') return (val as any)(...args);
    return val || key;
  };

  const mySlots = useMemo(() => user ? allSlots.filter(s => s.userId === user.id) : [], [allSlots, user]);

  return (
    <AppContext.Provider value={{ 
        user: user!, group, userGroups, allSlots, mySlots, lang, isLoading, error, logs,
        t, addSlot, removeSlot, refreshData: () => group && fetchSlots(group.id), 
        createNewGroup, switchGroup, leaveGroup, forceGroupLoad
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- UI COMPONENTS ---

const Header = () => {
    const context = useContext(AppContext);
    const [isMenuOpen, setMenuOpen] = useState(false);
    if (!context || !context.group) return <div className="bg-[#27272a] p-4 h-16"></div>;
    const { group, userGroups, switchGroup, t } = context;
    return (
        <div className="relative z-50">
            <div className="bg-[#27272a] p-4 flex justify-between items-center shadow-md relative z-20">
                <div onClick={() => setMenuOpen(!isMenuOpen)} className="flex items-center gap-2 cursor-pointer active:opacity-70 max-w-[70%]">
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2 truncate">
                            <span className="truncate">{group.title}</span> 
                            <i className={`fa-solid fa-chevron-down text-xs transition ${isMenuOpen ? 'rotate-180' : ''}`}></i>
                        </h1>
                        <p className="text-xs text-gray-400">{group.members.length} members • {group.tier}</p>
                    </div>
                </div>
                {group.tier === 'FREE' && ( <button className="text-xs bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-2 py-1 rounded font-bold shrink-0">{t('upgrade')}</button> )}
            </div>
            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 bg-[#27272a] border-t border-gray-700 shadow-2xl z-20 rounded-b-xl overflow-hidden slide-in">
                        <div className="p-3 bg-black/20 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('switch_group_title')}</div>
                        <div className="max-h-60 overflow-y-auto">
                            {userGroups.map(g => (
                                <button key={g.id} onClick={() => { switchGroup(g.id); setMenuOpen(false); }} className={`w-full text-left p-4 border-b border-gray-800 flex justify-between items-center ${g.id === group.id ? 'bg-[#3b82f6]/10 text-blue-400' : 'text-white hover:bg-white/5'}`}>
                                    <span className="font-medium truncate">{g.title}</span>
                                    {g.id === group.id && <i className="fa-solid fa-check text-blue-500"></i>}
                                </button>
                            ))}
                        </div>
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
                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-white">{isCyclic ? t('weekly') : t('one_time')}</span>{slot.description && <span className="text-xs text-gray-500 italic truncate max-w-[150px]">"{slot.description}"</span>}</div>
                <div className="text-xs text-gray-400">{isCyclic ? `${days[slot.dayOfWeek!]} • ${slot.startTimeLocal} - ${slot.endTimeLocal}` : `${new Date(slot.startAt!).toLocaleDateString(lang)} • ${new Date(slot.startAt!).toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}`}</div>
            </div>
            <button onClick={onDelete} className="text-red-400 p-2 active:scale-95 transition"><i className="fa-solid fa-trash"></i></button>
        </div>
    )
}

const MiniCalendar = ({ mySlots, selectedDate, onSelectDate }: { mySlots: BusySlot[], selectedDate: Date, onSelectDate: (d: Date) => void }) => {
    const { lang } = useContext(AppContext)!;
    const [viewDate, setViewDate] = useState(new Date());
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
    const changeMonth = (delta: number) => { const newDate = new Date(viewDate); newDate.setMonth(newDate.getMonth() + delta); setViewDate(newDate); };
    const checkSlotStatus = (day: number) => {
        const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dayOfWeek = checkDate.getDay();
        const dateStr = checkDate.toISOString().split('T')[0];
        let hasCyclic = false, hasOneTime = false;
        mySlots.forEach(slot => { if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek === dayOfWeek) hasCyclic = true; if (slot.type === 'ONE_TIME' && slot.startAt?.startsWith(dateStr)) hasOneTime = true; });
        return { hasCyclic, hasOneTime };
    };
    const daysLabels = lang === 'ru' ? ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
    return (
        <div className="bg-[#27272a] rounded-xl p-4 mb-4 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 text-gray-400 hover:text-white"><i className="fa-solid fa-chevron-left"></i></button>
                <h3 className="font-bold text-lg capitalize">{viewDate.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => changeMonth(1)} className="p-2 text-gray-400 hover:text-white"><i className="fa-solid fa-chevron-right"></i></button>
            </div>
            <div className="grid grid-cols-7 mb-2 text-center">{daysLabels.map((d, i) => <div key={i} className="text-xs text-gray-500 font-bold">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                    const { hasCyclic, hasOneTime } = checkSlotStatus(day);
                    let cellClass = "text-gray-400 hover:bg-white/5"; 
                    if (hasCyclic && hasOneTime) cellClass = "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 text-white";
                    else if (hasCyclic) cellClass = "bg-blue-500/10 border border-blue-500/20 text-blue-200";
                    else if (hasOneTime) cellClass = "bg-purple-500/10 border border-purple-500/20 text-purple-200";
                    if (isSelected) cellClass = "bg-[#3b82f6] text-white shadow-lg shadow-blue-500/50 scale-105 z-10 font-bold";
                    return ( <button key={day} onClick={() => { const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day); onSelectDate(d); }} className={`h-10 w-full rounded-xl flex items-center justify-center relative active:scale-95 transition-all ${cellClass}`}><span className="text-sm font-medium">{day}</span></button> );
                })}
            </div>
        </div>
    );
};

const AddSlotModal = ({ isOpen, onClose, initialDate }: { isOpen: boolean, onClose: () => void, initialDate: Date }) => {
    const { addSlot, t, lang } = useContext(AppContext)!;
    const [type, setType] = useState<SlotType>('ONE_TIME');
    const [selectedDays, setSelectedDays] = useState<number[]>([1]); 
    const [start, setStart] = useState("09:00");
    const [end, setEnd] = useState("18:00");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("");
    const [isAllDay, setIsAllDay] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => {
        if(isOpen) {
            setIsAllDay(false); setDescription(""); setIsSaving(false);
            if(initialDate) {
                const offset = initialDate.getTimezoneOffset();
                const adjDate = new Date(initialDate.getTime() - (offset*60*1000));
                setDate(adjDate.toISOString().split('T')[0]);
                setSelectedDays([initialDate.getDay()]);
            }
        }
    }, [isOpen, initialDate]);
    if (!isOpen) return null;
    const handleSave = async () => {
        setIsSaving(true);
        const finalStart = isAllDay ? "00:00" : start;
        const finalEnd = isAllDay ? "23:59" : end;
        if (type === 'CYCLIC_WEEKLY') {
            for (const day of selectedDays) await addSlot({ type, description, dayOfWeek: day, startTimeLocal: finalStart, endTimeLocal: finalEnd });
        } else {
            const startD = new Date(`${date}T${finalStart}:00`);
            const endD = new Date(`${date}T${finalEnd}:00`);
            await addSlot({ type, description, startAt: startD.toISOString(), endAt: endD.toISOString(), startTimeLocal: finalStart, endTimeLocal: finalEnd });
        }
        setIsSaving(false); onClose();
    };
    const daysLabels = lang === 'ru' ? ['В','П','В','С','Ч','П','С'] : ['S','M','T','W','T','F','S'];
    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end justify-center">
            <div className="bg-[#18181b] w-full max-w-md rounded-t-2xl p-6 pb-10 slide-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{t('i_am_busy')}</h2><button onClick={onClose} className="text-gray-400 p-2"><i className="fa-solid fa-xmark text-xl"></i></button></div>
                <div className="flex bg-[#27272a] p-1 rounded-lg mb-6"><button onClick={() => setType('ONE_TIME')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'ONE_TIME' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('one_time_btn')}</button><button onClick={() => setType('CYCLIC_WEEKLY')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'CYCLIC_WEEKLY' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('weekly_btn')}</button></div>
                <div className="space-y-6 mb-8">
                    {type === 'CYCLIC_WEEKLY' ? (
                        <div><label className="block text-xs text-gray-500 mb-3">{t('day_of_week')}</label><div className="flex justify-between">{daysLabels.map((d, i) => (<button key={i} onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(day => day !== i) : [...prev, i])} className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${selectedDays.includes(i) ? 'bg-[#3b82f6] text-white' : 'bg-[#27272a] text-gray-400'}`}>{d}</button>))}</div></div>
                    ) : ( <div><label className="block text-xs text-gray-500 mb-1">{t('date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" /></div> )}
                    <div>
                        <div className="flex justify-between items-center mb-2"><label className="text-xs text-gray-500">{t('from')} / {t('to')}</label><label className="flex items-center gap-2 cursor-pointer"><span className="text-xs text-gray-400">{t('all_day')}</span><div onClick={() => setIsAllDay(!isAllDay)} className={`w-10 h-5 rounded-full relative transition-colors ${isAllDay ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAllDay ? 'left-6' : 'left-1'}`}></div></div></label></div>
                        {!isAllDay && ( <div className="flex gap-4"><input type="time" value={start} onChange={e => setStart(e.target.value)} className="flex-1 bg-[#27272a] p-3 rounded-lg text-white" /><input type="time" value={end} onChange={e => setEnd(e.target.value)} className="flex-1 bg-[#27272a] p-3 rounded-lg text-white" /></div> )}
                    </div>
                    <div><label className="block text-xs text-gray-500 mb-1">{t('description')}</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white" /></div>
                </div>
                <button disabled={isSaving} onClick={handleSave} className="w-full bg-[#3b82f6] text-white py-4 rounded-xl font-bold">{isSaving ? '...' : t('save_availability')}</button>
            </div>
        </div>
    );
};

const MySlotsScreen = () => {
    const { mySlots, removeSlot, t, lang } = useContext(AppContext)!;
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const dailySlots = mySlots.filter(slot => { 
        if (slot.type === 'CYCLIC_WEEKLY') return slot.dayOfWeek === selectedDate.getDay(); 
        if (slot.type === 'ONE_TIME' && slot.startAt) { 
            const d = new Date(slot.startAt); 
            return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth(); 
        } 
        return false; 
    });
    return (
        <div className="p-4 pb-24">
            <MiniCalendar mySlots={mySlots} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t('my_busy_slots')} {selectedDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}</h2>
            {dailySlots.length === 0 ? ( <div className="text-center py-6 opacity-50 border border-dashed border-gray-700 rounded-xl"><p className="text-sm">{t('free_bird')}</p></div> ) : dailySlots.map(slot => <SlotCard key={slot.id} slot={slot} onDelete={() => removeSlot(slot.id)} />)}
            <button onClick={() => setModalOpen(true)} className="fixed bottom-24 right-4 bg-[#3b82f6] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-40"><i className="fa-solid fa-plus text-xl"></i></button>
            <AddSlotModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} initialDate={selectedDate} />
        </div>
    );
};

const SearchScreen = () => {
    const { group, allSlots, t, lang } = useContext(AppContext)!;
    const [results, setResults] = useState<{ start: Date, end: Date, durationMinutes: number }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
    useEffect(() => { if (group) setSelectedMembers(group.members.map(m => m.id)); }, [group]);
    if (!group) return null;
    const handleSearch = () => { setLoading(true); setTimeout(() => { setResults(TimeFinderService.findCommonFreeTime(group, allSlots, selectedMembers)); setLoading(false); }, 800); };
    return (
        <div className="p-4 pb-24 h-full">
            {!results && !loading && (
                <div className="flex flex-col h-full">
                    <div className="mb-6"><div className="bg-[#27272a] rounded-xl overflow-hidden max-h-48 overflow-y-auto">{group.members.map(m => ( <div key={m.id} onClick={() => setSelectedMembers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])} className="p-3 border-b border-gray-700 flex items-center gap-3"><div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedMembers.includes(m.id) ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-gray-500'}`}>{selectedMembers.includes(m.id) && <i className="fa-solid fa-check text-white text-xs"></i>}</div><span>{m.firstName}</span></div> ))}</div></div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center"><h2 className="text-xl font-bold mb-2">{t('find_time')}</h2><p className="text-gray-400 text-sm mb-8">{t('algo_desc', selectedMembers.length, PLAN_CONFIGS[group.tier].searchWindowDays)}</p><button onClick={handleSearch} className="bg-white text-black px-8 py-3 rounded-full font-bold">{t('find_magic_slot')}</button></div>
                </div>
            )}
            {loading && ( <div className="flex flex-col items-center justify-center h-[60vh]"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#3b82f6] mb-4"></i><p className="text-gray-400">{t('calculating')}</p></div> )}
            {results && (
                <div className="slide-in">
                    <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">{t('top_results')}</h2><button onClick={() => setResults(null)} className="text-[#3b82f6]">{t('reset')}</button></div>
                    {results.length === 0 ? ( <div className="bg-red-900/20 p-4 rounded-xl text-center"><p className="text-red-200">{t('no_common_time')}</p></div> ) : ( <div className="space-y-3">{results.slice(0, 5).map((res, i) => ( <div key={i} className="bg-[#27272a] p-4 rounded-xl flex items-center gap-4 border-l-4 border-green-500"><div><div className="font-bold text-lg">{res.start.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})} - {res.end.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}</div><div className="text-xs text-gray-500">{Math.floor(res.durationMinutes / 60)}h {res.durationMinutes % 60}m {t('duration')}</div></div></div> ))}</div> )}
                </div>
            )}
        </div>
    );
};

const SettingsScreen = () => {
    const { group, user, t, createNewGroup, leaveGroup, logs, forceGroupLoad } = useContext(AppContext)!;
    const [showDebug, setShowDebug] = useState(false);
    const [forceId, setForceId] = useState('');
    if (!group) return null;
    const inviteLink = `https://t.me/${BOT_USERNAME}/app?startapp=gid_${group.id}`;
    return (
        <div className="p-4 pb-20 overflow-y-auto h-full">
            <h2 className="text-xl font-bold mb-6">{t('settings')}</h2>
            <div className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] rounded-xl p-5 mb-6"><h3 className="font-bold text-white mb-4"><i className="fa-solid fa-user-plus"></i> {t('invite_friends')}</h3><button onClick={() => window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}`)} className="w-full bg-white text-blue-600 py-3 rounded-lg font-bold text-sm">{t('share')}</button></div>
            <div className="bg-[#27272a] rounded-xl overflow-hidden mb-6"><div className="p-4 border-b border-gray-700 flex justify-between"><span>{t('timezone')}</span><span className="text-gray-400">{user.timezone}</span></div></div>
            <button onClick={createNewGroup} className="w-full py-3 mb-3 text-blue-400 bg-[#27272a] rounded-xl border border-dashed border-gray-700">{t('create_group')}</button>
            <button onClick={() => leaveGroup(group.id)} className="w-full py-3 text-red-500 bg-[#27272a] rounded-xl">{t('leave_group')}</button>
            <button onClick={() => setShowDebug(!showDebug)} className="w-full py-3 mt-4 text-xs text-gray-600">🐞 Debug Logs</button>
            {showDebug && ( <div className="fixed inset-0 z-[100] bg-black/95 p-6 overflow-y-auto font-mono text-[10px] text-gray-300"><div className="flex justify-between mb-4"><h3 className="text-green-500">Debug</h3><button onClick={() => setShowDebug(false)}>✕</button></div><div className="mb-4 flex gap-2"><input type="number" className="flex-1 bg-gray-800 p-2" value={forceId} onChange={e => setForceId(e.target.value)} /><button onClick={() => forceGroupLoad(parseInt(forceId))} className="bg-yellow-600 px-3">Load</button></div>{logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}</div> )}
        </div>
    );
}

const EmptyStateScreen = () => {
    const { createNewGroup, t } = useContext(AppContext)!;
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
            <h1 className="text-2xl font-bold mb-2">{t('no_groups')}</h1>
            <p className="text-gray-400 mb-8">{t('no_groups_desc')}</p>
            <button onClick={() => window.open(`https://t.me/${BOT_USERNAME}?startgroup=true`, '_blank')} className="w-full max-w-xs bg-[#3b82f6] text-white py-3 rounded-xl font-bold mb-4">{t('add_to_group_btn')}</button>
            <button onClick={createNewGroup} className="text-[#3b82f6] text-sm font-bold">{t('create_group')}</button>
        </div>
    )
}

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('slots');
  const context = useContext(AppContext);
  if (context?.error) return <div className="min-h-screen bg-[#18181b] flex flex-col items-center justify-center p-8 text-center text-white"><h1 className="text-xl font-bold mb-4">Error</h1><p className="bg-red-900/20 p-4 rounded border border-red-500/30 text-red-200">{context.error}</p></div>
  if (context?.isLoading) return <div className="min-h-screen bg-[#18181b] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i></div>
  if (!context?.group) return <EmptyStateScreen />;
  return (
    <div className="min-h-screen bg-[#18181b] text-white">
      <Header />
      <main>{activeTab === 'slots' ? <MySlotsScreen /> : activeTab === 'search' ? <SearchScreen /> : <SettingsScreen />}</main>
      <TabBar active={activeTab} setTab={setActiveTab} />
    </div>
  );
};

const App = () => {
    useEffect(() => { if (window.Telegram?.WebApp) { window.Telegram.WebApp.ready(); window.Telegram.WebApp.expand(); } }, []);
    return <AppProvider><AppContent /></AppProvider>;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

declare global { interface Window { Telegram: any; } }
