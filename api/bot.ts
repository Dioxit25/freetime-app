import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// EXACT URL from BotFather (MUST MATCH 100%)
const WEB_APP_BASE = 'https://freetime-app-rho.vercel.app/';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓');
});

bot.start(async (ctx) => {
    await ctx.reply('Привет! 👋\nДобавьте меня в группу, чтобы создать общий календарь!', {
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Добавить в группу', url: `https://t.me/${ctx.botInfo.username}?startgroup=true` }
            ]]
        }
    });
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
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
});

bot.command('init', async (ctx) => {
    const chat = ctx.chat as any;
    if (chat.type === 'private') return ctx.reply('Только для групп!');
    await initializeGroup(ctx, chat.id, chat.title || 'Unknown');
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return ctx.reply("⚠️ Supabase error.");

    await supabase.from('groups').upsert({ id: chatId, title: chatTitle, tier: 'FREE' }, { onConflict: 'id' });

    // Using # (hash) often bypasses strict path validation for WebApp buttons in groups
    // and ensures Telegram treats it as the same domain registered in BotFather.
    const directUrl = `${WEB_APP_BASE}#gid_${chatId}`;

    try {
        await ctx.reply(
            `🗓 <b>Календарь группы "${chatTitle}"</b>\n\nНажмите кнопку ниже, чтобы открыть приложение в этом чате.`, 
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('🚀 Открыть Календарь', directUrl)]
                ])
            }
        );
    } catch (e: any) {
        console.error("Button creation failed:", e.message);
        // Fallback to direct link if webApp button fails validation
        const botName = ctx.botInfo.username;
        const fallbackLink = `https://t.me/${botName}/app?startapp=gid_${chatId}`;
        await ctx.reply(`⚠️ Используйте прямую ссылку: ${fallbackLink}`);
    }
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
        response.status(200).json({ error: e.message });
    }
}
