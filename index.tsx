import React, { useState, useEffect, useContext, createContext, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---

// ⚠️ ВСТАВЬТЕ СЮДА ДАННЫЕ ИЗ ШАГА 3 (Supabase -> Settings -> API)
const SUPABASE_URL = 'https://vprvsgjhlqxunnsleals.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_gVJj4zEufGL7LU4CC3C59g_3PuNxRpK';

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  description?: string; // New field
  // For ONE_TIME
  startAt?: string; // ISO String (UTC)
  endAt?: string;   // ISO String (UTC)
  // For CYCLIC_WEEKLY
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
    keep_updated_desc: "Tap a day to view or add slots.",
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
    pro_upsell: "Upgrade to Pro to see 30 days ahead and auto-sync with Google Calendar.",
    leave_group: "Leave Group",
    you: "(You)",
    timezone: "Timezone",
    my_name: "My Name",
    group_label: "GROUP",
    algo_desc: (count: number, days: number) => `Algorithm will check availability of ${count} members for the next ${days} days.`,
    setup_required: "Supabase Setup Required",
    setup_msg: "Please edit index.tsx and add your Supabase URL & Key to connect the database."
  },
  ru: {
    app_name: "TimeAgree",
    upgrade: "PREMIUM",
    my_slots: "Мои слоты",
    find_time: "Поиск",
    settings: "Настройки",
    keep_updated: "Ваш календарь",
    keep_updated_desc: "Нажмите на день, чтобы добавить или изменить слоты.",
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
    pro_upsell: "Купите Pro, чтобы искать на 30 дней вперед и синхронизировать с Google Календарем.",
    leave_group: "Покинуть группу",
    you: "(Вы)",
    timezone: "Часовой пояс",
    my_name: "Мое имя",
    group_label: "ГРУППА",
    algo_desc: (count: number, days: number) => `Алгоритм проверит доступность ${count} участников на ближайшие ${days} дн.`,
    setup_required: "Нужна настройка БД",
    setup_msg: "Пожалуйста, откройте index.tsx и укажите SUPABASE_URL и KEY."
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

// --- ALGORITHM SERVICE (The Core Solver) ---

class TimeFinderService {
  static findCommonFreeTime(
    group: Group,
    slots: BusySlot[],
    searchStartDate: Date = new Date()
  ): { start: Date; end: Date; durationMinutes: number }[] {
    
    const config = PLAN_CONFIGS[group.tier];
    const windowStart = new Date(searchStartDate);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + config.searchWindowDays);

    // 1. Normalize Slots
    const userBusyIntervals: Record<number, TimeSlot[]> = {};
    group.members.forEach(m => userBusyIntervals[m.id] = []);

    slots.forEach(slot => {
      if (!userBusyIntervals[slot.userId]) return;

      if (slot.type === 'ONE_TIME' && slot.startAt && slot.endAt) {
        userBusyIntervals[slot.userId].push({
          start: new Date(slot.startAt),
          end: new Date(slot.endAt)
        });
      } else if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek !== undefined && slot.startTimeLocal && slot.endTimeLocal) {
        const expanded = this.expandCyclicSlot(slot, windowStart, windowEnd, group.members.find(m => m.id === slot.userId)?.timezone || 'UTC');
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
    let commonFreeTime = Object.values(userFreeIntervals)[0] || [];
    if (commonFreeTime.length === 0 && Object.keys(userFreeIntervals).length > 0) {
        // If first user is completely blocked, common time is empty
    } else if (Object.keys(userFreeIntervals).length === 0) {
        // No users? Return empty
        commonFreeTime = [];
    } else {
        for (let i = 1; i < Object.values(userFreeIntervals).length; i++) {
            commonFreeTime = this.intersectIntervalLists(commonFreeTime, Object.values(userFreeIntervals)[i]);
        }
    }

    // 5. Filter by min duration
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

        // Simple MVP Logic: This currently assumes the slot is in the Viewer's timezone
        // TODO for production: use a library like 'date-fns-tz' to correctly offset this
        // based on `userTimezone` vs `Intl.DateTimeFormat().resolvedOptions().timeZone`
        
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
      if (curr.start <= prev.end) {
        prev.end = new Date(Math.max(prev.end.getTime(), curr.end.getTime()));
      } else {
        merged.push(curr);
      }
    }
    return merged;
  }

  private static invertIntervals(busy: TimeSlot[], windowStart: Date, windowEnd: Date): TimeSlot[] {
    const free: TimeSlot[] = [];
    let pointer = new Date(windowStart);

    for (const slot of busy) {
      if (slot.start > pointer) {
        free.push({ start: new Date(pointer), end: new Date(slot.start) });
      }
      pointer = new Date(Math.max(pointer.getTime(), slot.end.getTime()));
    }

    if (pointer < windowEnd) {
      free.push({ start: new Date(pointer), end: new Date(windowEnd) });
    }
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

      if (a.end < b.end) i++;
      else j++;
    }
    return intersections;
  }
}

// --- STATE MANAGEMENT ---

interface AppState {
  user: User;
  group: Group;
  allSlots: BusySlot[];
  mySlots: BusySlot[];
  lang: LangCode;
  isLoading: boolean;
  error: string | null;
  t: (key: keyof typeof TRANSLATIONS['en'] | string, ...args: any[]) => string;
  addSlot: (slot: Partial<BusySlot>) => void;
  removeSlot: (id: string) => void;
  refreshData: () => void;
}

const AppContext = createContext<AppState | null>(null);

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [allSlots, setAllSlots] = useState<BusySlot[]>([]);
  const [lang, setLang] = useState<LangCode>('en');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Get User Data from Telegram
        let tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        // FALLBACK FOR DEV MODE (Browser without Telegram)
        if (!tgUser) {
          console.warn("Telegram WebApp not detected. Using Mock User.");
          tgUser = { id: 101, first_name: "DevUser", username: "dev_alex", language_code: "en" };
        }

        setLang(tgUser.language_code?.startsWith('ru') ? 'ru' : 'en');

        // 2. Upsert User to DB
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

        // 3. Resolve Group Context
        const DEMO_GROUP_ID = -100999; 
        
        let { data: groupData, error: fetchGrpErr } = await supabase.from('groups').select('*').eq('id', DEMO_GROUP_ID).single();
        
        if (!groupData) {
          // If fetch failed because table doesn't exist, we need to catch that
          if (fetchGrpErr && fetchGrpErr.message.includes('relation "public.groups" does not exist')) {
             throw new Error("Database tables not found. Please run the SQL script in Supabase.");
          }

          // Create demo group if not exists
          const { data: newGroup, error: grpErr } = await supabase.from('groups').insert({
            id: DEMO_GROUP_ID,
            title: "Demo Team",
            tier: "FREE"
          }).select().single();
          
          if (grpErr) throw new Error(`Failed to create group: ${grpErr.message}`);
          groupData = newGroup;
        }

        if (!groupData) throw new Error("Critical: Group data unavailable.");

        // 4. Add User to Group if not exists
        // FIX: Changed from .insert().ignoreDuplicates() to .upsert() because .ignoreDuplicates() is not chainable on insert in v2
        const { error: memberError } = await supabase.from('group_members').upsert({
          group_id: DEMO_GROUP_ID,
          user_id: currentUser.id
        }, { onConflict: 'group_id, user_id', ignoreDuplicates: true });

        if (memberError) console.warn("Member join warning:", memberError.message);

        // 5. Fetch Full Group Details (Members)
        const { data: membersData, error: memErr } = await supabase
          .from('group_members')
          .select('user_id, users(id, username, first_name, timezone)')
          .eq('group_id', DEMO_GROUP_ID);

        if (memErr) throw new Error(`Failed to fetch members: ${memErr.message}`);
        
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

        // 6. Fetch Slots
        await fetchSlots(DEMO_GROUP_ID);

        setIsLoading(false);
      } catch (e: any) {
        console.error("Init failed:", e);
        setError(e.message || "Unknown error occurred during initialization.");
        setIsLoading(false);
      }
    };

    if (SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
        // Stop if not configured
        setIsLoading(false);
    } else {
        initApp();
    }
  }, []);

  // --- 2. DATA METHODS ---

  const fetchSlots = async (groupId: number) => {
    const { data, error } = await supabase.from('slots').select('*').eq('group_id', groupId);
    if (error) {
        console.error("Fetch slots error:", error);
        return;
    }
    if (data) {
        const mapped: BusySlot[] = data.map((s: any) => ({
            id: s.id,
            userId: s.user_id,
            groupId: s.group_id,
            type: s.type,
            description: s.description, // Added description mapping
            startAt: s.start_at,
            endAt: s.end_at,
            dayOfWeek: s.day_of_week,
            startTimeLocal: s.start_time_local?.slice(0,5),
            endTimeLocal: s.end_time_local?.slice(0,5)
        }));
        setAllSlots(mapped);
    }
  };

  // --- 3. REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!group) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots', filter: `group_id=eq.${group.id}` },
        (payload) => {
          console.log('Realtime change:', payload);
          fetchSlots(group.id); // Reload slots on any change from any user
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [group]);


  const addSlot = async (slot: Partial<BusySlot>) => {
    if (!user || !group) return;

    // Convert camelCase to snake_case for DB
    const dbPayload = {
        user_id: user.id,
        group_id: group.id,
        type: slot.type,
        description: slot.description, // Added description
        start_at: slot.startAt || null,
        end_at: slot.endAt || null,
        day_of_week: slot.dayOfWeek,
        start_time_local: slot.startTimeLocal,
        end_time_local: slot.endTimeLocal
    };

    const { error } = await supabase.from('slots').insert(dbPayload);
    if (error) {
        // Fallback for missing column (schema mismatch)
        if (error.message.includes('description') && (error.message.includes('column') || error.message.includes('schema'))) {
            const { description, ...safePayload } = dbPayload;
            const { error: retryErr } = await supabase.from('slots').insert(safePayload);
            if (retryErr) {
                alert("Error saving slot: " + retryErr.message);
            } else {
                alert("Warning: Note was not saved. Please update database schema (run SQL script).");
            }
        } else {
            alert("Error saving slot: " + error.message);
        }
    }
  };

  const removeSlot = async (id: string) => {
    await supabase.from('slots').delete().eq('id', id);
  };

  const t = (key: string, ...args: any[]) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    const val = dict[key as keyof typeof dict];
    if (typeof val === 'function') {
        // Fix for TS2556: Cast val to any or generic function to allow spread args
        return (val as any)(...args);
    }
    return val || key;
  };

  const mySlots = useMemo(() => {
    return user ? allSlots.filter(s => s.userId === user.id) : [];
  }, [allSlots, user]);

  return (
    <AppContext.Provider value={{ 
        user: user!, group: group!, allSlots, mySlots, lang, isLoading, error,
        t, addSlot, removeSlot, refreshData: () => group && fetchSlots(group.id) 
    }}>
      {children}
    </AppContext.Provider>
  );
};

// --- UI COMPONENTS ---
// ... (Previous UI Components remain mostly unchanged) ...

const Header = () => {
    const context = useContext(AppContext);
    if (!context || !context.group) return <div className="bg-[#27272a] p-4 h-16"></div>;
    const { group, t } = context;

    return (
        <div className="bg-[#27272a] p-4 flex justify-between items-center shadow-md">
            <div>
                <h1 className="text-lg font-bold text-white">{group.title}</h1>
                <p className="text-xs text-gray-400">{group.members.length} members • {group.tier}</p>
            </div>
            {group.tier === 'FREE' && (
                <button className="text-xs bg-gradient-to-r from-yellow-600 to-yellow-500 text-white px-2 py-1 rounded font-bold">
                    {t('upgrade')}
                </button>
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
    
    // Localized Days
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const days = lang === 'ru' ? daysRu : daysEn;
    
    return (
        <div className="bg-[#27272a] p-3 rounded-lg mb-2 flex justify-between items-center border-l-4 border-red-500 slide-in">
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                        {isCyclic ? t('weekly') : t('one_time')}
                    </span>
                    {slot.description && (
                        <span className="text-xs text-gray-500 italic truncate max-w-[150px]">
                            "{slot.description}"
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-400">
                    {isCyclic 
                        ? `${days[slot.dayOfWeek!]} • ${slot.startTimeLocal} - ${slot.endTimeLocal}`
                        : `${new Date(slot.startAt!).toLocaleDateString(lang)} • ${new Date(slot.startAt!).toLocaleTimeString(lang, {hour:'2-digit', minute:'2-digit'})}`
                    }
                </div>
            </div>
            <button onClick={onDelete} className="text-red-400 p-2 active:scale-95 transition">
                <i className="fa-solid fa-trash"></i>
            </button>
        </div>
    )
}

const AddSlotModal = ({ isOpen, onClose, initialDate }: { isOpen: boolean, onClose: () => void, initialDate: Date }) => {
    const { addSlot, t, lang } = useContext(AppContext)!;
    const [type, setType] = useState<SlotType>('ONE_TIME'); // Default to One Time when coming from Calendar
    const [selectedDays, setSelectedDays] = useState<number[]>([1]); 
    const [start, setStart] = useState("09:00");
    const [end, setEnd] = useState("18:00");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("");
    const [isAllDay, setIsAllDay] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if(isOpen) {
            setIsAllDay(false);
            setDescription("");
            setIsSaving(false);
            
            // Set initial date from Calendar selection
            if(initialDate) {
                // Adjust for timezone offset for input[type="date"]
                const offset = initialDate.getTimezoneOffset();
                const adjDate = new Date(initialDate.getTime() - (offset*60*1000));
                setDate(adjDate.toISOString().split('T')[0]);
                
                // Also set day of week in case user switches to Cyclic
                setSelectedDays([initialDate.getDay()]);
                
                // If the initial date is in the past, maybe default to next occurance for cyclic? 
                // For now, keep simple.
            }
        }
    }, [isOpen, initialDate]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (type === 'CYCLIC_WEEKLY' && selectedDays.length === 0) {
            return; // Needs validation UI in future
        }

        setIsSaving(true);
        
        // Prepare time values
        const finalStart = isAllDay ? "00:00" : start;
        const finalEnd = isAllDay ? "23:59" : end;

        const commonData = {
            type,
            description,
            startTimeLocal: finalStart,
            endTimeLocal: finalEnd
        };

        if (type === 'CYCLIC_WEEKLY') {
            // Create a slot for EACH selected day
            for (const day of selectedDays) {
                await addSlot({ 
                    ...commonData, 
                    dayOfWeek: day 
                });
            }
        } else {
            const startD = new Date(`${date}T${finalStart}:00`);
            const endD = new Date(`${date}T${finalEnd}:00`);
            
            await addSlot({ 
                ...commonData, 
                startAt: startD.toISOString(), 
                endAt: endD.toISOString() 
            });
        }

        setIsSaving(false);
        onClose();
    };

    const toggleDay = (dayIndex: number) => {
        setSelectedDays(prev => 
            prev.includes(dayIndex) 
                ? prev.filter(d => d !== dayIndex) 
                : [...prev, dayIndex]
        );
    };

    const daysEn = ['S','M','T','W','T','F','S'];
    const daysRu = ['В','П','В','С','Ч','П','С'];
    const daysLabels = lang === 'ru' ? daysRu : daysEn;

    return (
        // z-[60] to stay above TabBar (z-50)
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-end justify-center">
            {/* Added pb-6 to lift content, ensuring button is visible above safe area/bottom browser bar */}
            <div className="bg-[#18181b] w-full max-w-md rounded-t-2xl p-6 pb-10 slide-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{t('i_am_busy')}</h2>
                    <button onClick={onClose} className="text-gray-400 p-2"><i className="fa-solid fa-xmark text-xl"></i></button>
                </div>

                {/* TYPE SWITCHER */}
                <div className="flex bg-[#27272a] p-1 rounded-lg mb-6">
                    <button onClick={() => setType('ONE_TIME')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'ONE_TIME' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('one_time_btn')}</button>
                    <button onClick={() => setType('CYCLIC_WEEKLY')} className={`flex-1 py-2 text-sm rounded-md transition ${type === 'CYCLIC_WEEKLY' ? 'bg-[#3b82f6] text-white' : 'text-gray-400'}`}>{t('weekly_btn')}</button>
                </div>

                <div className="space-y-6 mb-8">
                    {/* DAYS / DATE SELECTOR */}
                    {type === 'CYCLIC_WEEKLY' ? (
                        <div>
                            <label className="block text-xs text-gray-500 mb-3">{t('day_of_week')}</label>
                            <div className="flex justify-between">
                                {daysLabels.map((d, i) => {
                                    const isSelected = selectedDays.includes(i);
                                    return (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleDay(i)} 
                                            className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${isSelected ? 'bg-[#3b82f6] text-white scale-110 shadow-lg shadow-blue-500/30' : 'bg-[#27272a] text-gray-400'}`}
                                        >
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div>
                             <label className="block text-xs text-gray-500 mb-1">{t('date')}</label>
                             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                    )}

                    {/* TIME SELECTOR */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs text-gray-500">{t('from')} / {t('to')}</label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs text-gray-400">{t('all_day')}</span>
                                <div 
                                    onClick={() => setIsAllDay(!isAllDay)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${isAllDay ? 'bg-blue-500' : 'bg-gray-600'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isAllDay ? 'left-6' : 'left-1'}`}></div>
                                </div>
                            </label>
                        </div>
                        
                        {!isAllDay && (
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500" />
                                </div>
                            </div>
                        )}
                        {isAllDay && (
                            <div className="w-full bg-[#27272a]/50 p-3 rounded-lg text-center text-gray-500 text-sm italic border border-gray-700">
                                00:00 — 23:59
                            </div>
                        )}
                    </div>

                    {/* DESCRIPTION */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">{t('description')}</label>
                        <input 
                            type="text" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="..."
                            className="w-full bg-[#27272a] p-3 rounded-lg text-white outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600" 
                        />
                    </div>
                </div>

                {/* ACTION BUTTON */}
                <button 
                    disabled={isSaving || (type === 'CYCLIC_WEEKLY' && selectedDays.length === 0)} 
                    onClick={handleSave} 
                    className="w-full bg-[#3b82f6] text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition disabled:opacity-50 disabled:scale-100 shadow-xl shadow-blue-500/20 mb-4"
                >
                    {isSaving ? '...' : t('save_availability')}
                </button>
            </div>
        </div>
    );
};

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

    // Helper to check if a specific date has any slots
    const checkSlotStatus = (day: number) => {
        const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        const dayOfWeek = checkDate.getDay();
        const dateStr = checkDate.toISOString().split('T')[0];

        let hasCyclic = false;
        let hasOneTime = false;

        mySlots.forEach(slot => {
            if (slot.type === 'CYCLIC_WEEKLY' && slot.dayOfWeek === dayOfWeek) {
                hasCyclic = true;
            }
            if (slot.type === 'ONE_TIME' && slot.startAt?.startsWith(dateStr)) {
                hasOneTime = true;
            }
        });

        return { hasCyclic, hasOneTime };
    };

    const daysEn = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const daysRu = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const daysLabels = lang === 'ru' ? daysRu : daysEn;

    return (
        <div className="bg-[#27272a] rounded-xl p-4 mb-4 shadow-lg">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 text-gray-400 hover:text-white"><i className="fa-solid fa-chevron-left"></i></button>
                <h3 className="font-bold text-lg capitalize">
                    {viewDate.toLocaleDateString(lang, { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => changeMonth(1)} className="p-2 text-gray-400 hover:text-white"><i className="fa-solid fa-chevron-right"></i></button>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 mb-2 text-center">
                {daysLabels.map((d, i) => (
                    <div key={i} className="text-xs text-gray-500 font-bold">{d}</div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = 
                        selectedDate.getDate() === day && 
                        selectedDate.getMonth() === viewDate.getMonth() &&
                        selectedDate.getFullYear() === viewDate.getFullYear();
                    
                    const { hasCyclic, hasOneTime } = checkSlotStatus(day);
                    
                    // Styles
                    let bgClass = 'bg-transparent';
                    if (isSelected) bgClass = 'bg-[#3b82f6] text-white shadow-lg shadow-blue-500/50';
                    else if (hasCyclic) bgClass = 'bg-blue-900/40 text-blue-100 border border-blue-800';
                    else bgClass = 'hover:bg-white/5';

                    return (
                        <button 
                            key={day} 
                            onClick={() => {
                                const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                                onSelectDate(d);
                            }}
                            className={`h-10 w-full rounded-lg flex flex-col items-center justify-center relative transition-all active:scale-95 ${bgClass}`}
                        >
                            <span className="text-sm font-medium">{day}</span>
                            {hasOneTime && (
                                <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isSelected ? 'bg-white' : 'bg-red-500'}`}></span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const MySlotsScreen = () => {
    const { mySlots, removeSlot, t, lang } = useContext(AppContext)!;
    const [isModalOpen, setModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Filter slots for the selected date
    const dailySlots = mySlots.filter(slot => {
        if (slot.type === 'CYCLIC_WEEKLY') {
            return slot.dayOfWeek === selectedDate.getDay();
        }
        if (slot.type === 'ONE_TIME' && slot.startAt) {
            const slotDate = new Date(slot.startAt);
            return (
                slotDate.getDate() === selectedDate.getDate() &&
                slotDate.getMonth() === selectedDate.getMonth() &&
                slotDate.getFullYear() === selectedDate.getFullYear()
            );
        }
        return false;
    });

    return (
        <div className="p-4 pb-24">
            <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 p-4 rounded-xl mb-6 border border-blue-500/20">
                <h3 className="font-bold text-blue-100 mb-1">{t('keep_updated')}</h3>
                <p className="text-xs text-blue-200/70">{t('keep_updated_desc')}</p>
            </div>

            <MiniCalendar 
                mySlots={mySlots} 
                selectedDate={selectedDate} 
                onSelectDate={setSelectedDate} 
            />

            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                {t('my_busy_slots')} {selectedDate.toLocaleDateString(lang, { day: 'numeric', month: 'long' })}
            </h2>
            
            {dailySlots.length === 0 ? (
                <div className="text-center py-6 opacity-50 border border-dashed border-gray-700 rounded-xl">
                    <i className="fa-solid fa-mug-hot text-2xl mb-2 text-gray-600"></i>
                    <p className="text-sm">{t('free_bird')}</p>
                </div>
            ) : (
                dailySlots.map(slot => <SlotCard key={slot.id} slot={slot} onDelete={() => removeSlot(slot.id)} />)
            )}

            <button onClick={() => setModalOpen(true)} className="fixed bottom-24 right-4 bg-[#3b82f6] text-white w-14 h-14 rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition z-40">
                <i className="fa-solid fa-plus text-xl"></i>
            </button>

            <AddSlotModal 
                isOpen={isModalOpen} 
                onClose={() => setModalOpen(false)} 
                initialDate={selectedDate}
            />
        </div>
    );
};

const SearchScreen = () => {
    const { group, allSlots, t, lang } = useContext(AppContext)!;
    const [results, setResults] = useState<{ start: Date, end: Date, durationMinutes: number }[] | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = () => {
        setLoading(true);
        setTimeout(() => {
            const commonTime = TimeFinderService.findCommonFreeTime(group, allSlots);
            setResults(commonTime);
            setLoading(false);
        }, 800);
    };

    return (
        <div className="p-4 pb-24 h-full">
            {!results && !loading && (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                    <div className="w-20 h-20 bg-[#27272a] rounded-full flex items-center justify-center mb-6">
                         <i className="fa-solid fa-wand-magic-sparkles text-3xl text-yellow-500"></i>
                    </div>
                    <h2 className="text-xl font-bold mb-2">{t('find_time')}</h2>
                    <p className="text-gray-400 text-sm max-w-xs mb-8">
                        {t('algo_desc', group.members.length, PLAN_CONFIGS[group.tier].searchWindowDays)}
                    </p>
                    <button onClick={handleSearch} className="bg-white text-black px-8 py-3 rounded-full font-bold shadow-lg active:scale-95 transition">
                        {t('find_magic_slot')}
                    </button>
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
    const { group, user, t } = useContext(AppContext)!;
    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-6">{t('settings')}</h2>
            
            <div className="bg-[#27272a] rounded-xl overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <span>{t('timezone')}</span>
                    <span className="text-gray-400 text-sm">{user.timezone}</span>
                </div>
                <div className="p-4 flex justify-between items-center">
                    <span>{t('my_name')}</span>
                    <span className="text-gray-400 text-sm">@{user.username}</span>
                </div>
            </div>

            <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase">{t('group_label')}: {group.title}</h3>
            <div className="bg-[#27272a] rounded-xl overflow-hidden mb-6">
                {group.members.map(m => (
                    <div key={m.id} className="p-4 border-b border-gray-700 last:border-0 flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${m.id === user.id ? 'bg-[#3b82f6] text-white' : 'bg-gray-700 text-gray-300'}`}>
                             {m.firstName ? m.firstName[0] : '?'}
                         </div>
                         <div className="flex-1">
                             <div className="text-sm">{m.firstName} {m.id === user.id && t('you')}</div>
                             <div className="text-[10px] text-gray-500">@{m.username}</div>
                         </div>
                    </div>
                ))}
            </div>
            
            <button className="w-full py-3 text-red-500 text-sm font-bold bg-[#27272a] rounded-xl">
                {t('leave_group')}
            </button>
            <div className="text-center mt-6 text-xs text-gray-600">
                FreeTime v1.0.1 (Alpha)
            </div>
        </div>
    );
}

const AppContent = () => {
  const [activeTab, setActiveTab] = useState('slots');
  const context = useContext(AppContext);

  // If no Supabase config provided yet
  if (SUPABASE_URL.includes("YOUR_PROJECT_ID")) {
      return (
        <div className="min-h-screen bg-[#18181b] text-white flex flex-col items-center justify-center p-6 text-center">
            <i className="fa-solid fa-database text-4xl mb-4 text-yellow-500"></i>
            <h1 className="text-xl font-bold mb-2">Supabase Setup Required</h1>
            <p className="text-gray-400 text-sm">Please open <code>index.tsx</code> and replace <code>SUPABASE_URL</code> and <code>SUPABASE_KEY</code> with your project details.</p>
        </div>
      )
  }
  
  // Show error if initialization failed (likely DB issue)
  if (context?.error) {
      return (
        <div className="min-h-screen bg-[#18181b] text-white flex flex-col items-center justify-center p-8 text-center">
            <i className="fa-solid fa-triangle-exclamation text-4xl mb-4 text-red-500"></i>
            <h1 className="text-xl font-bold mb-2">Setup Error</h1>
            <p className="text-red-200 text-sm mb-6 bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                {context.error}
            </p>
            <div className="text-left text-xs text-gray-400 bg-gray-900 p-4 rounded overflow-auto w-full max-h-40">
                <p className="font-bold mb-2">Did you run the SQL script?</p>
                <code className="block whitespace-pre text-gray-500">
                    Go to Supabase {'>'} SQL Editor and run:{'\n'}
                    create table public.users...
                </code>
            </div>
        </div>
      )
  }

  if (context?.isLoading) {
      return (
        <div className="min-h-screen bg-[#18181b] flex items-center justify-center">
            <i className="fa-solid fa-circle-notch fa-spin text-white text-2xl"></i>
        </div>
      )
  }

  // Basic "Router"
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
      <main>
        {renderScreen()}
      </main>
      <TabBar active={activeTab} setTab={setActiveTab} />
    </div>
  );
};

const App = () => {
    // Initialize Telegram WebApp
    useEffect(() => {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    }, []);

    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
};

// --- ENTRY POINT ---

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Type definition hack for TypeScript in this env
declare global {
  interface Window {
    Telegram: any;
  }
}
