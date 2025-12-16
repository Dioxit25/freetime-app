import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

// Используем переменные окружения Vite (должны начинаться с VITE_)
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_KEY;
// Имя бота можно оставить хардкодом или тоже вынести в .env
const BOT_USERNAME = 'FreeTimeBot'; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE credentials missing! Check your Vercel Environment Variables.");
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// --- TYPES (Domain Layer) ---

type SlotType = 'ONE_TIME' | 'CYCLIC_WEEKLY';
type PlanTier = 'FREE' | 'GROUP_PRO' | 'BUSINESS';
type LangCode = 'en' | 'ru';

interface User {
  id: number;
  username: string;
  firstName: string;
  timezone: string; // IANA timezone
  languageCode?: string;
}

interface Group {
  id: number; // Telegram Chat ID
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
  startAt?: string; // ISO String (UTC)
  endAt?: string;   // ISO String (UTC)
  dayOfWeek?: number; // 0 (Sun) - 6 (Sat)
  startTimeLocal?: string; // "HH:MM"
  endTimeLocal?: string;   // "HH:MM"
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

// --- LOCALIZATION (I18n) ---

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

// --- CONFIG & CONSTANTS ---

const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  FREE: {
    maxMembers: 7,
    searchWindowDays: 7,
    minSlotDurationMin: 30,
    allowAutoSearch: false,
  },
  GROUP_PRO: {
    maxMembers: 50,
    searchWindowDays: 30,
    minSlotDurationMin: 15,
    allowAutoSearch: true,
  },
  BUSINESS: {
    maxMembers: 200,
    searchWindowDays: 60,
    minSlotDurationMin: 15,
    allowAutoSearch: true,
  }
};

// --- ALGORITHM SERVICE ---

class TimeFinderService {
  static findCommonFreeTime(
    group: Group,
    slots: BusySlot[],
    memberIdsToInclude: number[],
    searchStartDate: Date = new Date()
  ): { start: Date; end: Date; durationMinutes: number }[] {
    
    const config = PLAN_CONFIGS[group.tier];
    const windowStart = new Date(searchStartDate);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + config.searchWindowDays);

    const activeMembers = group.members.filter(m => memberIdsToInclude.includes(m.id));
    if (activeMembers.length === 0) return [];

    // 1. Normalize Slots
    const userBusyIntervals: Record<number, TimeSlot[]> = {};
    activeMembers.forEach(m => userBusyIntervals[m.id] = []);

    slots.forEach(slot => {
      if (!memberIdsToInclude.includes(slot.userId)) return;
      if (!userBusyIntervals[slot.userId]) return;

      if (slot.type === 'ONE_TIME' && slot.startAt && slot.endAt) {
        userBusyIntervals[slot.userId].push({
          start: new Date(slot.startAt),
          end: new Date(slot.endAt)
        });
      } else if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined && slot.startTimeLocal && slot.endTimeLocal) {
        const userTz = activeMembers.find(m => m.id === slot.userId)?.timezone || 'UTC';
        const expanded = this.expandCyclicSlot(slot, windowStart, windowEnd, userTz);
        userBusyIntervals[slot.userId].push(...expanded);
      }
    });

    // 2. Merge overlapping
    Object.keys(userBusyIntervals).forEach(key => {
      const uid = parseInt(key);
      userBusyIntervals[uid] = this.mergeIntervals(userBusyIntervals[uid]);
    });

    // 3. Invert
    const userFreeIntervals: Record<number, TimeSlot[]> = {};
    Object.keys(userBusyIntervals).forEach(key => {
      const uid = parseInt(key);
      userFreeIntervals[uid] = this.invertIntervals(userBusyIntervals[uid], windowStart, windowEnd);
    });

    // 4. Find Intersection
    const firstUserId = activeMembers[0].id;
    let commonFreeTime = userFreeIntervals[firstUserId] || [];

    for (let i = 1; i < activeMembers.length; i++) {
        const uid = activeMembers[i].id;
        commonFreeTime = this.intersectIntervalLists(commonFreeTime, userFreeIntervals[uid] || []);
    }

    return commonFreeTime
      .map(slot => ({
        ...slot,
        durationMinutes: (slot.end.getTime() - slot.start.getTime()) / (1000 * 60)
      }))
      .filter(slot => slot.durationMinutes >= config.minSlotDurationMin)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private static expandCyclicSlot(slot: BusySlot, windowStart: Date, windowEnd: Date, _userTimezone: string): TimeSlot[] {
    const result: TimeSlot[] = [];
    let current = new Date(windowStart);
    current.setHours(0,0,0,0);

    while (current < windowEnd) {
      if (current.getDay() === slot.dayOfWeek) {
        const [startH, startM] = (slot.startTimeLocal || "00:00").split(':').map(Number);
        const [endH, endM] = (slot.endTimeLocal || "23:59").split(':').map(Number);
        const start = new Date(current);
        start.setHours(startH, startM, 0, 0);
        const end = new Date(current);
        end.setHours(endH, endM, 0, 0);
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
    let i = 0;
    let j = 0;
    while (i < listA.length && j < listB.length) {
      const a = listA[i];
      const b = listB[j];
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
  t: (key: string, ...args: any[]) => string;
  addSlot: (slot: Partial<BusySlot>) => void;
  removeSlot: (id: string) => void;
  refreshData: () => void;
  createNewGroup: () => void;
  switchGroup: (groupId: number) => void;
  leaveGroup: (groupId: number) => void;
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

  useEffect(() => {
    const initApp = async () => {
      try {
        let tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
        
        if (!tgUser) {
          console.warn("Telegram WebApp not detected. Using Mock User.");
          tgUser = { id: 101, first_name: "DevUser", username: "dev_alex", language_code: "en" };
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

        let targetGroupId: number | null = null;

        // PRIORITY 1: Deep Link Invite
        if (startParam && startParam.startsWith('gid_')) {
            const idStr = startParam.split('_')[1];
            const inviteId = parseInt(idStr);
            console.log("Detected Invite Launch:", inviteId);
            
            if (!isNaN(inviteId)) {
                // If we have a backend bot, the Group SHOULD already exist in 'groups' table.
                // We just link the user.
                const { error: joinErr } = await supabase.from('group_members').upsert({
                    group_id: inviteId,
                    user_id: currentUser.id
                }, { onConflict: 'group_id, user_id' });
                
                if (!joinErr) {
                    targetGroupId = inviteId;
                }
            }
        }

        // Fetch User's Groups (Loaded from DB)
        await fetchUserGroups(currentUser.id);

        // PRIORITY 2: Fallback (Last used or None)
        if (!targetGroupId) {
            const { data: membersData } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
            // If user has groups, pick the first one
            if (membersData && membersData.length > 0) {
                targetGroupId = membersData[0].group_id; 
            }
            // IF user has NO groups, we do NOT create a fake one automatically anymore.
            // We want them to add the bot to a real group.
        }

        if (targetGroupId) {
            await loadGroupData(targetGroupId);
        } else {
            // No groups loaded. State remains group: null
            setIsLoading(false);
        }

      } catch (e: any) {
        console.error("Init failed:", e);
        setError(e.message);
        setIsLoading(false);
      }
    };

    if (!SUPABASE_URL || !SUPABASE_KEY) {
         setError("Supabase configuration missing. Please check Vercel Environment Variables.");
    } else {
         initApp();
    }
  }, []);

  const fetchUserGroups = async (userId: number) => {
      const { data } = await supabase
        .from('group_members')
        .select('group_id, groups(id, title)')
        .eq('user_id', userId);
      
      const list = data?.map((r: any) => ({ id: r.groups.id, title: r.groups.title })).filter((g: any) => g.id && g.title) || [];
      setUserGroups(list);
  };

  const loadGroupData = async (groupId: number) => {
    setIsLoading(true);
    const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (!groupData) { setIsLoading(false); return; }

    const { data: membersData } = await supabase
        .from('group_members')
        .select('user_id, users(id, username, first_name, timezone)')
        .eq('group_id', groupId);

    const members: User[] = membersData?.map((m: any) => ({
        id: m.users.id,
        username: m.users.username,
        firstName: m.users.first_name,
        timezone: m.users.timezone
    })) || [];

    setGroup({
        id: groupData.id,
        title: groupData.title,
        tier: groupData.tier as PlanTier,
        members: members
    });

    await fetchSlots(groupId);
    setIsLoading(false);
  };

  const fetchSlots = async (groupId: number) => {
    const { data } = await supabase.from('slots').select('*').eq('group_id', groupId);
    if (data) {
        const mapped: BusySlot[] = data.map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            groupId: s.group_id,
            type: s.type,
            description: s.description,
            startAt: s.start_at,
            endAt: s.end_at,
            dayOfWeek: s.day_of_week,
            startTimeLocal: s.start_time_local?.slice(0,5),
            endTimeLocal: s.end_time_local?.slice(0,5)
        }));
        setAllSlots(mapped);
    }
  };

  const createNewGroup = async () => {
      // Manual creation is still allowed for "Personal" testing without a chat
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

  const switchGroup = async (groupId: number) => {
      await loadGroupData(groupId);
  };

  const leaveGroup = async (groupId: number) => {
      if (!user) return;
      if (!confirm(t('confirm_leave'))) return;
      
      await supabase.from('group_members').delete().match({ group_id: groupId, user_id: user.id });
      await fetchUserGroups(user.id);
      
      const remaining = userGroups.filter(g => g.id !== groupId);
      if (remaining.length > 0) {
          switchGroup(remaining[0].id);
      } else {
          setGroup(null); // Show "No groups" state
      }
  };

  useEffect(() => {
    if (!group) return;
    const channel = supabase.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `group_id=eq.${group.id}` }, () => fetchSlots(group.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [group]);

  const addSlot = async (slot: Partial<BusySlot>) => {
    if (!user || !group) return;
    const dbPayload = {
        user_id: user.id,
        group_id: group.id,
        type: slot.type,
        description: slot.description,
        start_at: slot.startAt || null,
        end_at: slot.endAt || null,
        day_of_week: slot.dayOfWeek,
        start_time_local: slot.startTimeLocal,
        end_time_local: slot.endTimeLocal
    };
    await supabase.from('slots').insert(dbPayload);
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
        user: user!, group: group, userGroups, allSlots, mySlots, lang, isLoading, error,
        t, addSlot, removeSlot, refreshData: () => group && fetchSlots(group.id), 
        createNewGroup, switchGroup, leaveGroup
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
                {group.tier === 'FREE' && (
                    <button className="text-xs bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-2 py-1 rounded font-bold shrink-0">
                        {t('upgrade')}
                    </button>
                )}
            </div>

            {isMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-10" onClick={() => setMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 bg-[#27272a] border-t border-gray-700 shadow-2xl z-20 rounded-b-xl overflow-hidden slide-in">
                        <div className="p-3 bg-black/20 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('switch_group_title')}</div>
                        <div className="max-h-60 overflow-y-auto">
                            {userGroups.map(g => (
                                <button 
                                    key={g.id} 
                                    onClick={() => { switchGroup(g.id); setMenuOpen(false); }}
                                    className={`w-full text-left p-4 border-b border-gray-800 flex justify-between items-center ${g.id === group.id ? 'bg-[#3b82f6]/10 text-blue-400' : 'text-white hover:bg-white/5'}`}
                                >
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 w-1/3 ${active ? 'text-[#3b82f6]' : 'text-gray-500'}`}>
    <i className={`fa-solid ${icon} text-xl`}></i>
    <span className="text-[10px]">{label}</span>
  </button>
);

const SlotCard: React.FC<{ slot: BusySlot; onDelete: () => void }> = ({ slot, onDelete }) => {
    const { t, lang } = useContext(AppContext)!;
    const isCyclic = slot.type === 'CYCLIC_WEEKLY';
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const days = lang === 'ru' ? daysRu : daysEn;
    
    return (
        <div className="bg-[#27272a] p-3 rounded-lg mb-2 flex justify-between items-center border-l-4 border-red-500 slide-in">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{isCyclic ? t('weekly') : t('one_time')}</span>
                    {slot.description && <span className="text-xs text-gray-500 italic truncate max-w-[150px]">"{slot.description}"</span>}
                </div>
                <div className="text-xs text-gray-400">
                    {isCyclic 
                        ? `${days[slot.dayOfWeek!]} • ${slot.startTimeLocal} - ${slot.endTimeLocal}`
                        : `${new Date(slot.startAt!).toLocaleDateString(lang)} • ${new Date(slot.startAt!).toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}`}
                </div>
            </div>
            <button onClick={onDelete} className="text-red-400 p-2 active:scale-95 transition"><i className="fa-solid fa-trash"></i></button>
        </div>
    )
}

const MiniCalendar = ({ 
    mySlots, 
    selectedDate, 
    onSelectDate 
}: { 
    mySlots: BusySlot[], 
    selectedDate: Date, 
    onSelectDate: (d: Date) => void 
}) => {
    const { lang } = useContext(AppContext)!;
    const [viewDate, setViewDate] = useState(new Date());

    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 = Sun

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const checkSlotStatus = (day: number) => {
        const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dayOfWeek = checkDate.getDay();
        const dateStr = checkDate.toISOString().split('T')[0];
        let hasCyclic = false;
        let hasOneTime = false;
        mySlots.forEach(slot => {
            if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek === dayOfWeek) hasCyclic = true;
            if (slot.type === 'ONE_TIME' && slot.startAt?.startsWith(dateStr)) hasOneTime = true;
        });
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
            <div className="grid grid-cols-7 mb-2 text-center">
                {daysLabels.map((d, i) => <div key={i} className="text-xs text-gray-500 font-bold">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
                    const { hasCyclic, hasOneTime } = checkSlotStatus(day);
                    
                    let cellClass = "text-gray-400 hover:bg-white/5"; 
                    const glassBase = "backdrop-blur-sm border shadow-inner transition-all";

                    if (hasCyclic && hasOneTime) {
                        cellClass = `${glassBase} bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/10 text-white`;
                    } else if (hasCyclic) {
                        cellClass = `${glassBase} bg-blue-500/10 border-blue-500/20 text-blue-200`;
                    } else if (hasOneTime) {
                        cellClass = `${glassBase} bg-purple-500/10 border-purple-500/20 text-purple-200`;
                    }

                    if (isSelected) {
                        cellClass = "bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] border border-blue-400 font-bold scale-105 z-10";
                    }

                    return (
                        <button key={day} onClick={() => { const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day); onSelectDate(d); }} className={`h-10 w-full rounded-xl flex items-center justify-center relative active:scale-95 ${cellClass}`}>
                            <span className="text-sm font-medium">{day}</span>
                        </button>
                    );
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
        if (type === 'CYCLIC_WEEKLY' && selectedDays.length === 0) return;
        setIsSaving(true);
        const finalStart = isAllDay ? "00:00" : start;
        const finalEnd = isAllDay ? "23:59" : end;
        const commonData = { type, description, startTimeLocal: finalStart, endTimeLocal: finalEnd };
        if (type === 'CYCLIC_WEEKLY') {
            for (const day of selectedDays) await addSlot({ ...commonData, dayOfWeek: day });
        } else {
            const startD = new Date(`${date}T${finalStart}:00`);
            const endD = new Date(`${date}T${finalEnd}:00`);
            await addSlot({ ...commonData, startAt: startD.toISOString(), endAt: endD.toISOString() });
        }
        setIsSaving(false); onClose();
    };

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
    };
    const daysLabels = lang === 'ru' ? ['В','П','В','С','Ч','П','С'] : ['S','M','T','W','T','F','S'];

    return (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end justify-center">
            <div className="bg-[#18181b] w-full max-w-md rounded-t-2xl p-6 pb-10 slide-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{t('i_am_busy')}</h2>
                    <button onClick={onClose} className="text-gray-400 p-2"><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>
                <div className="flex bg-[#27272a] p-1 rounded-lg mb-6">
                    <button onClick={() => setType('ONE_TIME')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'ONE_TIME' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('one_time_btn')}</button>
                    <button onClick={() => setType('CYCLIC_WEEKLY')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'CYCLIC_WEEKLY' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('weekly_btn')}</button>
                </div>
                <div className="space-y-6 mb-8">
                    {type === 'CYCLIC_WEEKLY' ? (
                        <div>
                            <label className="block text-xs text-gray-500 mb-3">{t('day_of_week')}</label>
                            <div className="flex justify-between">
                                {daysLabels.map((d, i) => (
                                    <button key={i} onClick={() => toggleDay(i)} className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${selectedDays.includes(i) ? 'bg-[#3b82f6] text-white scale-110' : 'bg-[#27272a] text-gray-400'}`}>{d}</button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div><label className="block text-xs text-gray-500 mb-1">{t('date')}</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" /></div>
                    )}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-gray-500">{t('from')} / {t('to')}</label>
                            <label className="flex items-center gap-2 cursor-pointer"><span className="text-xs text-gray-400">{t('all_day')}</span><div onClick={() => setIsAllDay(!isAllDay)} className={`w-10 h-5 rounded-full relative transition-colors ${isAllDay ? 'bg-blue-500' : 'bg-gray-600'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAllDay ? 'left-6' : 'left-1'}`}></div></div></label>
                        </div>
                        {!isAllDay && (
                            <div className="flex gap-4">
                                <div className="flex-1"><input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" /></div>
                                <div className="flex-1"><input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" /></div>
                            </div>
                        )}
                        {isAllDay && <div className="w-full bg-[#27272a]/50 p-3 rounded-lg text-center text-gray-500 text-sm italic border border-gray-700">00:00 — 23:59</div>}
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('description')}</label>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="..." className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" />
                    </div>
                </div>
                <button disabled={isSaving || (type === 'CYCLIC_WEEKLY' && selectedDays.length === 0)} onClick={handleSave} className="w-full bg-[#3b82f6] text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition disabled:opacity-50 disabled:scale-100 shadow-xl shadow-blue-500/20 mb-4">{isSaving ? '...' : t('save_availability')}</button>
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
            const slotDate = new Date(slot.startAt);
            return slotDate.getDate() === selectedDate.getDate() && slotDate.getMonth() === selectedDate.getMonth() && slotDate.getFullYear() === selectedDate.getFullYear();
        }
        return false;
    });

    return (
        <div className="p-4 pb-24">
            <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 p-4 rounded-xl mb-6 border border-blue-500/20">
                <h3 className="font-bold text-blue-100 mb-1">{t('keep_updated')}</h3>
                <p className="text-xs text-blue-200/70">{t('keep_updated_desc')}</p>
            </div>
            <MiniCalendar mySlots={mySlots} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t('my_busy_slots')} {selectedDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}</h2>
            {dailySlots.length === 0 ? (
                <div className="text-center py-6 opacity-50 border border-dashed border-gray-700 rounded-xl">
                    <i className="fa-solid fa-mug-hot text-2xl mb-2 text-gray-600"></i>
                    <p className="text-sm">{t('free_bird')}</p>
                </div>
            ) : dailySlots.map(slot => <SlotCard key={slot.id} slot={slot} onDelete={() => removeSlot(slot.id)} />)}
            <button onClick={() => setModalOpen(true)} className="fixed bottom-24 right-4 bg-[#3b82f6] text-white w-14 h-14 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition z-40"><i className="fa-solid fa-plus text-xl"></i></button>
            <AddSlotModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} initialDate={selectedDate} />
        </div>
    );
};

const SearchScreen = () => {
    const { group, allSlots, t, lang } = useContext(AppContext)!;
    const [results, setResults] = useState<{ start: Date, end: Date, durationMinutes: number }[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

    useEffect(() => {
        if (group) setSelectedMembers(group.members.map(m => m.id));
    }, [group]);

    if (!group) return null;

    const handleSearch = () => {
        setLoading(true);
        setTimeout(() => {
            const commonTime = TimeFinderService.findCommonFreeTime(group, allSlots, selectedMembers);
            setResults(commonTime);
            setLoading(false);
        }, 800);
    };

    const toggleMember = (id: number) => {
        setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
    };

    const toggleAll = () => {
        if (selectedMembers.length === group.members.length) setSelectedMembers([]);
        else setSelectedMembers(group.members.map(m => m.id));
    };

    return (
        <div className="p-4 pb-24 h-full">
            {!results && !loading && (
                <div className="flex flex-col h-full">
                    {/* Member Selection */}
                    <div className="mb-6 slide-in">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold uppercase text-gray-500">{t('select_members')}</h3>
                            <button onClick={toggleAll} className="text-xs text-[#3b82f6] font-bold">{t('select_all')}</button>
                        </div>
                        <div className="bg-[#27272a] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                            {group.members.map(m => {
                                const isSelected = selectedMembers.includes(m.id);
                                return (
                                    <div key={m.id} onClick={() => toggleMember(m.id)} className="p-3 border-b border-gray-700 last:border-0 flex items-center gap-3 active:bg-white/5 transition cursor-pointer">
                                         <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${isSelected ? 'bg-[#3b82f6] border-[#3b82f6]' : 'border-gray-500'}`}>
                                             {isSelected && <i className="fa-solid fa-check text-white text-xs"></i>}
                                         </div>
                                         <span className="text-sm">{m.firstName}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-[#27272a] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-yellow-500/10">
                             <i className="fa-solid fa-wand-magic-sparkles text-3xl text-yellow-500"></i>
                        </div>
                        <h2 className="text-xl font-bold mb-2">{t('find_time')}</h2>
                        <p className="text-gray-400 text-sm max-w-xs mb-8">{t('algo_desc', selectedMembers.length, PLAN_CONFIGS[group.tier].searchWindowDays)}</p>
                        <button disabled={selectedMembers.length < 2} onClick={handleSearch} className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition disabled:opacity-50 disabled:scale-100">
                            {t('find_magic_slot')}
                        </button>
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                     <i className="fa-solid fa-circle-notch fa-spin text-3xl text-[#3b82f6] mb-4"></i>
                     <p className="text-gray-400 animate-pulse">{t('calculating')}</p>
                </div>
            )}

            {results && (
                <div className="slide-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold">{t('top_results')}</h2>
                        <button onClick={() => setResults(null)} className="text-xs text-[#3b82f6]">{t('reset')}</button>
                    </div>

                    {results.length === 0 ? (
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl text-center">
                            <p className="text-red-200">{t('no_common_time')}</p>
                            <p className="text-xs text-red-300/50 mt-1">{t('everyone_busy')}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {results.slice(0, 5).map((res, i) => (
                                <div key={i} className="bg-[#27272a] p-4 rounded-xl flex items-center gap-4 border-l-4 border-green-500">
                                    <div className="bg-green-500/20 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-green-400">
                                        <span className="text-[10px] font-bold uppercase">{res.start.toLocaleDateString(lang, {weekday: 'short'})}</span>
                                        <span className="text-sm font-bold">{res.start.getDate()}</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg">
                                            {res.start.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})} - {res.end.toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {Math.floor(res.durationMinutes / 60)}h {res.durationMinutes % 60}m {t('duration')}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    <div className="mt-8 p-4 border border-dashed border-gray-700 rounded-xl text-center opacity-70">
                        <i className="fa-solid fa-lock text-gray-500 mb-2"></i>
                        <p className="text-sm text-gray-400">{t('pro_upsell')}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const SettingsScreen = () => {
    const { group, user, t, createNewGroup, leaveGroup } = useContext(AppContext)!;
    const [copied, setCopied] = useState(false);
    
    if (!group) return null;

    const inviteLink = `https://t.me/${BOT_USERNAME}/app?startapp=gid_${group.id}`;
    
    const handleCopy = () => { 
        navigator.clipboard.writeText(inviteLink); 
        setCopied(true); 
        setTimeout(() => setCopied(false), 2000); 
    };

    const handleShare = () => {
        const text = `Join my group "${group.title}" in FreeTime!`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
        
        // Use Telegram native sharing if available
        if (window.Telegram?.WebApp?.openTelegramLink) {
            window.Telegram.WebApp.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    };

    return (
        <div className="p-4 pb-20 overflow-y-auto h-full">
            <h2 className="text-xl font-bold mb-6">{t('settings')}</h2>
            <div className="bg-gradient-to-r from-[#3b82f6] to-[#2563eb] rounded-xl p-5 mb-6 shadow-lg shadow-blue-900/20">
                <h3 className="font-bold text-white text-lg mb-1 flex items-center gap-2"><i className="fa-solid fa-user-plus"></i> {t('invite_friends')}</h3>
                <p className="text-blue-100 text-xs mb-4">{t('invite_desc')}</p>
                
                {/* Main Action Button */}
                <button onClick={handleShare} className="w-full bg-white text-blue-600 py-3 rounded-lg font-bold text-sm mb-3 shadow-md active:scale-95 transition flex items-center justify-center gap-2">
                    <i className="fa-solid fa-paper-plane"></i> {t('share')}
                </button>

                <div className="flex gap-2">
                    <div className="bg-black/20 flex-1 rounded px-3 py-2 text-xs font-mono text-blue-100 truncate flex items-center border border-white/10">{inviteLink}</div>
                    <button onClick={handleCopy} className="bg-white/20 text-white px-3 py-2 rounded font-bold text-xs active:scale-95 transition hover:bg-white/30">{copied ? <i className="fa-solid fa-check"></i> : <i className="fa-regular fa-copy"></i>}</button>
                </div>
            </div>
            
            <div className="bg-[#27272a] rounded-xl overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center"><span>{t('timezone')}</span><span className="text-gray-400 text-sm">{user.timezone}</span></div>
                <div className="p-4 flex justify-between items-center"><span>{t('my_name')}</span><span className="text-gray-400 text-sm">@{user.username}</span></div>
            </div>

            <div className="flex justify-between items-center mb-2 px-1">
                <h3 className="text-sm font-bold text-gray-500 uppercase">{t('group_label')}: {group.title}</h3>
                <span className="text-[10px] text-gray-600 font-mono">ID: {group.id}</span>
            </div>
            <div className="bg-[#27272a] rounded-xl overflow-hidden mb-6">
                {group.members.map(m => (
                    <div key={m.id} className="p-4 border-b border-gray-700 last:border-0 flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${m.id === user.id ? 'bg-[#3b82f6] text-white' : 'bg-gray-700 text-gray-300'}`}>{m.firstName ? m.firstName[0] : '?'}</div>
                         <div className="flex-1"><div className="text-sm">{m.firstName} {m.id === user.id && t('you')}</div><div className="text-[10px] text-gray-500">@{m.username}</div></div>
                    </div>
                ))}
            </div>

            <button onClick={createNewGroup} className="w-full py-3 mb-3 text-blue-400 text-sm font-bold bg-[#27272a] rounded-xl border border-dashed border-gray-700 hover:bg-[#323236] transition"><i className="fa-solid fa-plus mr-2"></i> {t('create_group')}</button>
            <button onClick={() => leaveGroup(group.id)} className="w-full py-3 text-red-500 text-sm font-bold bg-[#27272a] rounded-xl hover:bg-[#323236] transition">{t('leave_group')}</button>
            <div className="text-center mt-6 text-xs text-gray-600">FreeTime v1.0.5 (Beta)</div>
        </div>
    );
}

const EmptyStateScreen = () => {
    const { createNewGroup, t } = useContext(AppContext)!;
    const [showSetup, setShowSetup] = useState(false);
    const [token, setToken] = useState('');
    const [generatedLink, setGeneratedLink] = useState('');

    const handleAddBot = () => {
        window.open(`https://t.me/${BOT_USERNAME}?startgroup=true`, '_blank');
    };

    const handleGenerate = () => {
        // Strip extra chars if user copy-pasted weirdly
        const cleanToken = token.trim();
        const origin = window.location.origin; // https://myapp.vercel.app
        const link = `https://api.telegram.org/bot${cleanToken}/setWebhook?url=${origin}/api/bot`;
        setGeneratedLink(link);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
            <div className="w-24 h-24 bg-[#27272a] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/10">
                <i className="fa-solid fa-user-group text-4xl text-[#3b82f6]"></i>
            </div>
            <h1 className="text-2xl font-bold mb-2">{t('no_groups')}</h1>
            <p className="text-gray-400 mb-8 max-w-xs">{t('no_groups_desc')}</p>
            
            <button onClick={handleAddBot} className="w-full max-w-xs bg-[#3b82f6] text-white py-3 rounded-xl font-bold mb-4 shadow-lg active:scale-95 transition">
                {t('add_to_group_btn')}
            </button>
            <button onClick={createNewGroup} className="text-[#3b82f6] text-sm font-bold p-2 mb-8">
                {t('create_group')} (Personal)
            </button>

            {/* Developer Helper Tool */}
            <div className="w-full max-w-xs border-t border-gray-800 pt-6 mt-6">
                <button 
                    onClick={() => setShowSetup(!showSetup)} 
                    className="text-xs text-gray-600 flex items-center justify-center gap-2 mx-auto hover:text-gray-400"
                >
                    <i className="fa-solid fa-wrench"></i> Setup Webhook (Dev)
                </button>
                
                {showSetup && (
                    <div className="mt-4 bg-[#1e1e20] p-4 rounded-lg text-left slide-in border border-gray-700">
                        <p className="text-[10px] text-gray-400 mb-2">Use this if the bot is silent in groups. Only works on Vercel (not localhost).</p>
                        <input 
                            type="text" 
                            placeholder="Paste Bot Token here..." 
                            className="w-full bg-black/30 text-xs p-2 rounded border border-gray-700 mb-2 text-white"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                        <button 
                            onClick={handleGenerate} 
                            className="w-full bg-gray-700 text-xs py-2 rounded text-white font-bold mb-2"
                        >
                            Generate Link
                        </button>
                        
                        {generatedLink && (
                            <a 
                                href={generatedLink} 
                                target="_blank" 
                                className="block text-center bg-green-600 text-white text-xs py-2 rounded font-bold"
                            >
                                Click to Set Webhook
                            </a>
                        )}
                        {window.location.hostname === 'localhost' && (
                             <p className="text-red-500 text-[10px] mt-2 font-bold">⚠️ Warning: You are on localhost. Telegram cannot reach this URL.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('slots');
  const context = useContext(AppContext);

  if (context?.error) return <div className="min-h-screen bg-[#18181b] text-white flex flex-col items-center justify-center p-8 text-center"><i className="fa-solid fa-triangle-exclamation text-4xl mb-4 text-red-500"></i><h1 className="text-xl font-bold mb-2">Setup Error</h1><p className="text-red-200 text-sm mb-6 bg-red-900/20 p-4 rounded-lg border border-red-500/30">{context.error}</p></div>
  if (context?.isLoading) return <div className="min-h-screen bg-[#18181b] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i></div>

  // If user has no groups and no direct invite, show empty state
  if (!context?.group) return <EmptyStateScreen />;

  const renderScreen = () => {
      switch(activeTab) {
          case 'slots': return <MySlotsScreen />;
          case 'search': return <SearchScreen />;
          case 'settings': return <SettingsScreen />;
          default: return <MySlotsScreen />;
      }
  }

  return (
    <div className="min-h-screen bg-[#18181b] text-white">
      <Header />
      <main>{renderScreen()}</main>
      <TabBar active={activeTab} setTab={setActiveTab} />
    </div>
  );
};

const App = () => {
    useEffect(() => {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    }, []);
    return <AppProvider><AppContent /></AppProvider>;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

declare global { interface Window { Telegram: any; } }
