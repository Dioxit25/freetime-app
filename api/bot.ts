import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// IMPORTANT: This URL must be registered in BotFather!
const WEB_APP_URL = 'https://freetime-app-rho.vercel.app';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let botInfoCache: any = null;

async function getBotUsername() {
    if (bot.botInfo) return bot.botInfo.username;
    if (botInfoCache) return botInfoCache.username;
    try {
        botInfoCache = await bot.telegram.getMe();
        return botInfoCache.username;
    } catch (e) {
        return 'FreeTimeBot';
    }
}

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓');
});

bot.start(async (ctx) => {
    const username = await getBotUsername();
    await ctx.reply('Привет! 👋\nЯ помогу найти время для встреч.\n\nДобавьте меня в группу с друзьями!', {
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Добавить в группу', url: `https://t.me/${username}?startgroup=true` }
            ]]
        }
    });
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    try {
        const chat = ctx.chat;
        if (chat.type === 'group' || chat.type === 'supergroup') {
            const newMember = (ctx.message as any)?.new_chat_member;
            const myStatus = ctx.myChatMember?.new_chat_member?.status;
            const title = (chat as any).title || 'New Group';

            if (newMember?.id === (await bot.telegram.getMe()).id || myStatus === 'member' || myStatus === 'administrator') {
                 await initializeGroup(ctx, chat.id, title);
            }
        }
    } catch (e) {
        console.error("Event error:", e);
    }
});

bot.command('init', async (ctx) => {
    const chat = ctx.chat as any;
    if (chat.type === 'private') return ctx.reply('Только для групп!');
    await initializeGroup(ctx, chat.id, chat.title || 'Unknown');
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return ctx.reply("⚠️ Ошибка БД.");

    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) return ctx.reply(`⚠️ Ошибка БД: ${error.message}`);

    // DIRECT LAUNCH URL with query parameter
    // index.tsx logic: startParam = urlParams.get('gid')
    const directUrl = `${WEB_APP_URL}?gid=${chatId}`;

    try {
        await ctx.reply(
            `🗓 <b>Календарь для группы "${chatTitle}" готов!</b>`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: '🚀 Открыть Прямо Здесь', 
                            web_app: { url: directUrl } 
                        }
                    ]]
                }
            }
        );
    } catch (e: any) {
        // Fallback to Deep Link if web_app button still fails for some reason
        const username = await getBotUsername();
        await ctx.reply(`Используйте эту ссылку для входа:\nhttps://t.me/${username}/app?startapp=gid_${chatId}`);
    }
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    if (request.method === 'GET') return response.status(200).json({ status: 'OK' });

    try {
        if (!bot.botInfo) bot.botInfo = botInfoCache || await bot.telegram.getMe();
        await bot.handleUpdate(request.body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        response.status(200).json({ error: e.message });
    }
}
