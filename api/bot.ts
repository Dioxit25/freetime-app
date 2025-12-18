import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

const BOT_USERNAME = 'TimeAgreeBot';
const APP_SHORT_NAME = 'app'; // Change this if your app has a different short name in BotFather
const APP_LINK_BASE = `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`;

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- UTILS FOR CALCULATION ---
interface TimeSlot { start: Date; end: Date; }

function findIntersections(members: any[], slots: any[], days: number = 7): TimeSlot[] {
    const windowStart = new Date(); windowStart.setHours(0,0,0,0);
    const windowEnd = new Date(windowStart); windowEnd.setDate(windowEnd.getDate() + days);

    const userFreeIntervals: Record<number, TimeSlot[]> = {};

    members.forEach(m => {
        const userId = m.user_id;
        const busy: TimeSlot[] = [];
        slots.filter(s => s.user_id === userId).forEach(s => {
            if (s.type === 'ONE_TIME' && s.start_at && s.end_at) {
                busy.push({ start: new Date(s.start_at), end: new Date(s.end_at) });
            } else if (s.type === 'CYCLIC_WEEKLY' && s.day_of_week !== undefined) {
                let curr = new Date(windowStart);
                while(curr < windowEnd) {
                    if (curr.getDay() === s.day_of_week) {
                        const startTime = s.start_time_local;
                        const endTime = s.end_time_local;
                        if (startTime && endTime) {
                            const [sh, sm] = startTime.split(':').map(Number);
                            const [eh, em] = endTime.split(':').map(Number);
                            const start = new Date(curr); start.setHours(sh, sm, 0, 0);
                            const end = new Date(curr); end.setHours(eh, em, 0, 0);
                            busy.push({ start, end });
                        }
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }
        });

        const sortedBusy = busy.sort((a,b) => a.start.getTime() - b.start.getTime());
        const merged: TimeSlot[] = [];
        if (sortedBusy.length) {
            let last = sortedBusy[0];
            for (let i = 1; i < sortedBusy.length; i++) {
                if (sortedBusy[i].start <= last.end) {
                    last.end = new Date(Math.max(last.end.getTime(), sortedBusy[i].end.getTime()));
                } else { 
                    merged.push(last); 
                    last = sortedBusy[i]; 
                }
            }
            merged.push(last);
        }

        const free: TimeSlot[] = [];
        let p = new Date(windowStart);
        merged.forEach(b => {
            if (b.start > p) free.push({ start: new Date(p), end: new Date(b.start) });
            p = new Date(Math.max(p.getTime(), b.end.getTime()));
        });
        if (p < windowEnd) free.push({ start: p, end: windowEnd });
        userFreeIntervals[userId] = free;
    });

    const memberIds = members.map(m => m.user_id);
    if (!memberIds.length) return [];
    
    let common = userFreeIntervals[memberIds[0]] || [];
    for (let i = 1; i < memberIds.length; i++) {
        const l2 = userFreeIntervals[memberIds[i]] || [];
        const result: TimeSlot[] = [];
        let a = 0, b = 0;
        while(a < common.length && b < l2.length) {
            const s = new Date(Math.max(common[a].start.getTime(), l2[b].start.getTime()));
            const e = new Date(Math.min(common[a].end.getTime(), l2[b].end.getTime()));
            if (s < e) result.push({ start: s, end: e });
            if (common[a].end < l2[b].end) a++; else b++;
        }
        common = result;
    }
    return common.filter(s => (s.end.getTime() - s.start.getTime()) >= 30 * 60000);
}

// --- COMMANDS ---

bot.start(async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    await ctx.reply('👋 <b>Привет! Я TimeAgree.</b>\n\nЯ помогаю находить общее свободное время в группах.\n\n🔐 <b>Вход автоматический.</b> Просто нажми на кнопку ниже:', {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🚀 Открыть Приложение', url: APP_LINK_BASE }],
                [{ text: '👥 Добавить в группу', url: `https://t.me/${BOT_USERNAME}?startgroup=true` }]
            ]
        }
    });
});

bot.help(async (ctx) => {
    await ctx.reply('📚 <b>Доступные команды:</b>\n\n/init — Активировать календарь в этой группе\n/find — Найти лучшие окна для встречи\n\n<i>Для стабильной работы сделайте бота администратором группы.</i>', { parse_mode: 'HTML' });
});

bot.command('find', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply('Используйте эту команду в группе!');
    if (!supabase) return;

    try {
        const chatId = ctx.chat.id;
        const { data: members, error: memError } = await supabase.from('group_members').select('user_id').eq('group_id', chatId);
        
        if (memError) throw memError;

        // Use m instead of minus for startapp parameters
        const groupParam = chatId.toString().replace('-', 'm');
        const appUrl = `${APP_LINK_BASE}?startapp=gid_${groupParam}`;

        if (!members || members.length === 0) {
            return ctx.reply('🤔 В этой группе пока никто не заполнил календарь.\n\nЧтобы участвовать, просто перейдите в приложение:', {
                reply_markup: { inline_keyboard: [[{ text: '🚀 Присоединиться', url: appUrl }]] }
            });
        }

        const { data: slots, error: slotError } = await supabase.from('slots').select('*').eq('group_id', chatId);
        if (slotError) throw slotError;

        const results = findIntersections(members, slots || []);

        if (results.length === 0) {
            return ctx.reply('😔 К сожалению, общих окон на ближайшую неделю не найдено.', {
                reply_markup: { inline_keyboard: [[{ text: '📅 Мой Календарь', url: appUrl }]] }
            });
        }

        const text = results.slice(0, 5).map(r => {
            const date = r.start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
            const time = `${r.start.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})} - ${r.end.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}`;
            return `✅ <b>${date}</b>: ${time}`;
        }).join('\n');

        await ctx.reply(`✨ <b>Лучшие окна для встречи:</b>\n\n${text}\n\n<i>Найдено среди ${members.length} участников.</i>`, { 
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: '📅 Весь календарь группы', url: appUrl }
                ]]
            }
        });
    } catch (e: any) {
        console.error("Find error:", e);
        await ctx.reply(`❌ Произошла ошибка при поиске времени: ${e.message}`);
    }
});

bot.on('my_chat_member', async (ctx) => {
    const status = ctx.myChatMember.new_chat_member.status;
    if (status === 'member' || status === 'administrator') {
        const chatId = ctx.chat.id;
        const chatTitle = (ctx.chat as any).title || 'Группа';
        await initializeGroup(ctx, chatId, chatTitle);
    }
});

bot.command('init', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply('Команда доступна только в группах!');
    await initializeGroup(ctx, ctx.chat.id, (ctx.chat as any).title || 'Группа');
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('groups').upsert({ id: chatId, title: chatTitle, tier: 'FREE' }, { onConflict: 'id' });
        if (error) throw error;

        const groupParam = chatId.toString().replace('-', 'm');
        const appUrl = `${APP_LINK_BASE}?startapp=gid_${groupParam}`;
        
        await ctx.reply(
            `🗓 <b>Календарь для "${chatTitle}" активирован!</b>\n\nНажмите кнопку ниже, чтобы один раз авторизоваться и попасть в общую сетку.`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🚀 Перейти в календарь', url: appUrl }
                    ]]
                }
            }
        );
    } catch (e: any) { 
        console.error("Init error:", e);
        await ctx.reply(`❌ Ошибка инициализации группы: ${e.message}`);
    }
}

export default async function handler(request: any, response: any) {
    if (request.method === 'GET') return response.status(200).json({ status: 'OK' });
    try {
        const me = await bot.telegram.getMe();
        bot.botInfo = me;
        await bot.handleUpdate(request.body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        response.status(200).json({ error: e.message });
    }
}
