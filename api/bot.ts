import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

const WEB_APP_BASE = 'https://freetime-app-rho.vercel.app/';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- UTILS FOR CALCULATION ---
interface TimeSlot { start: Date; end: Date; }

function findIntersections(members: any[], slots: any[], days: number = 7): TimeSlot[] {
    const windowStart = new Date(); windowStart.setHours(0,0,0,0);
    const windowEnd = new Date(windowStart); windowEnd.setDate(windowEnd.getDate() + days);

    const userFreeIntervals: Record<number, TimeSlot[]> = {};

    members.forEach(m => {
        const busy: TimeSlot[] = [];
        slots.filter(s => s.user_id === m.user_id).forEach(s => {
            if (s.type === 'ONE_TIME' && s.start_at && s.end_at) {
                busy.push({ start: new Date(s.start_at), end: new Date(s.end_at) });
            } else if (s.type === 'CYCLIC_WEEKLY' && s.day_of_week !== undefined) {
                let curr = new Date(windowStart);
                while(curr < windowEnd) {
                    if (curr.getDay() === s.day_of_week) {
                        const [sh, sm] = s.start_time_local!.split(':').map(Number);
                        const [eh, em] = s.end_time_local!.split(':').map(Number);
                        const start = new Date(curr); start.setHours(sh, sm, 0, 0);
                        const end = new Date(curr); end.setHours(eh, em, 0, 0);
                        busy.push({ start, end });
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
                if (sortedBusy[i].start <= last.end) last.end = new Date(Math.max(last.end.getTime(), sortedBusy[i].end.getTime()));
                else { merged.push(last); last = sortedBusy[i]; }
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
        userFreeIntervals[m.user_id] = free;
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
    await ctx.reply('Привет! 👋\nЯ помогу вашей группе выбрать время для встречи.\n\nДобавьте меня в группу, и я создам общий календарь!', {
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Добавить в группу', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }
            ]]
        }
    });
});

bot.command('find', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply('Используйте эту команду в группе!');
    if (!supabase) return;

    const chatId = ctx.chat.id;
    const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', chatId);
    if (!members || members.length === 0) return ctx.reply('В группе пока нет активных участников календаря. Откройте приложение, чтобы зарегистрироваться.');

    const { data: slots } = await supabase.from('slots').select('*').eq('group_id', chatId);
    const results = findIntersections(members, slots || []);

    if (results.length === 0) {
        return ctx.reply('😔 К сожалению, общих окон на ближайшую неделю не найдено среди всех участников.');
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
                { text: '🚀 Открыть календарь', url: `${WEB_APP_BASE}?gid=${chatId}` }
            ]]
        }
    });
});

// Use my_chat_member to only handle the bot's own status changes to avoid duplicates
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
    await initializeGroup(ctx, ctx.chat.id, (ctx.chat as any).title || 'Unknown');
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return;
    try {
        await supabase.from('groups').upsert({ id: chatId, title: chatTitle, tier: 'FREE' }, { onConflict: 'id' });
        const appLink = `${WEB_APP_BASE}?gid=${chatId}`;
        await ctx.reply(
            `🗓 <b>Календарь для "${chatTitle}" готов!</b>\n\nОтмечайте занятое время в приложении, а потом используйте команду /find для поиска встречи.`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🚀 Открыть Календарь', url: appLink }
                    ]]
                }
            }
        );
    } catch (e) { console.error("Init error:", e); }
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
