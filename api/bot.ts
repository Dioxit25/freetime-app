import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// Base URL of your deployed site
const WEB_APP_BASE = 'https://freetime-app-rho.vercel.app/';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓 Бот на связи.');
});

bot.start(async (ctx) => {
    await ctx.reply('Привет! 👋\nЯ помогу вашей группе выбрать время для встречи.\n\nДобавьте меня в группу и используйте /init для создания календаря!', {
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Добавить в группу', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }
            ]]
        }
    });
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    try {
        const chat = ctx.chat;
        if (chat.type === 'group' || chat.type === 'supergroup') {
            const myId = (await bot.telegram.getMe()).id;
            const newMembers = (ctx.message as any)?.new_chat_members || [];
            const isMeAdded = newMembers.some((m: any) => m.id === myId);
            const isStatusChange = ctx.myChatMember?.new_chat_member?.status === 'member' || ctx.myChatMember?.new_chat_member?.status === 'administrator';

            if (isMeAdded || isStatusChange) {
                 await initializeGroup(ctx, chat.id, (chat as any).title || 'Group');
            }
        }
    } catch (e) {
        console.error("Event error:", e);
    }
});

bot.command('init', async (ctx) => {
    const chat = ctx.chat as any;
    if (chat.type === 'private') return ctx.reply('Команда доступна только в группах!');
    await initializeGroup(ctx, chat.id, chat.title || 'Unknown');
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return ctx.reply("⚠️ Ошибка подключения к базе данных.");

    // Регистрируем группу в Supabase
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) return ctx.reply(`❌ Ошибка БД: ${error.message}`);

    // Формируем прямую ссылку на сайт с параметром ID группы
    const appLink = `${WEB_APP_BASE}?gid=${chatId}`;

    await ctx.reply(
        `🗓 <b>Календарь для "${chatTitle}" готов!</b>\n\nНажмите на кнопку ниже, чтобы открыть веб-приложение и отметить свободное время.`, 
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { 
                        text: '🚀 Открыть Календарь', 
                        url: appLink 
                    }
                ]]
            }
        }
    );
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    if (request.method === 'GET') return response.status(200).json({ status: 'OK' });

    try {
        const me = await bot.telegram.getMe();
        bot.botInfo = me;
        await bot.handleUpdate(request.body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        console.error("Webhook handler error:", e.message);
        response.status(200).json({ error: e.message });
    }
}
