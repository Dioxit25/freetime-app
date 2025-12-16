import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// YOUR DEPLOYED URL
const WEB_APP_URL = 'https://freetime-app-rho.vercel.app';

// Initial log
console.log(`[STARTUP] Token Present: ${!!BOT_TOKEN}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let botInfoCache: any = null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    console.log(`[CMD] /ping from ${ctx.from.id}`);
    await ctx.reply('Pong! 🏓 Я работаю.');
});

bot.start(async (ctx) => {
    console.log(`[CMD] /start from ${ctx.from.id}`);
    const username = ctx.botInfo?.username || 'FreeTimeBot';
    
    // Using raw JSON for start button as well just to be safe
    await ctx.reply('Привет! 👋\nЯ помогу найти время для встреч.\n\nДобавьте меня в группу с друзьями, и я создам общий календарь!', {
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
        console.log(`[EVENT] Member Status Change in ${chat.id}`);
        
        if (chat.type === 'group' || chat.type === 'supergroup') {
            const newMember = (ctx.message as any)?.new_chat_member;
            const myStatus = ctx.myChatMember?.new_chat_member?.status;
            // Safe access to title
            const title = (chat as any).title || 'New Group';

            if (newMember?.id === ctx.botInfo.id || myStatus === 'member' || myStatus === 'administrator') {
                 await initializeGroup(ctx, chat.id, title);
            }
        }
    } catch (e) {
        console.error("Error in event handler:", e);
    }
});

bot.command('init', async (ctx) => {
    try {
        console.log(`[CMD] /init in chat: ${ctx.chat.id}`);
        
        // Explicitly cast chat to allow access to .title property without TS errors
        const chat = ctx.chat as any;
        const title = chat.title || 'Unknown Group';
        
        if (chat.type === 'private') {
            return ctx.reply('Команда /init работает только внутри групп. Добавьте меня в группу!');
        }

        await initializeGroup(ctx, chat.id, title);
    } catch (e: any) {
        console.error("Critical error in /init:", e);
        await ctx.reply(`❌ Ошибка бота: ${e.message}`);
    }
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    console.log(`[INIT] Group: ${chatTitle} (${chatId})`);

    if (!supabase) {
        return ctx.reply("⚠️ Ошибка: База данных не подключена (проверьте переменные окружения).");
    }

    // 1. Register/Update Group
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) {
        console.error("[DB ERROR]", error);
        return ctx.reply(`⚠️ Ошибка базы данных: ${error.message}`);
    }

    // 2. Prepare Link
    const webAppUrl = `${WEB_APP_URL}?gid=${chatId}`;

    // 3. Send Reply using RAW JSON for maximum compatibility
    try {
        await ctx.reply(
            `🗓 <b>Календарь для группы "${chatTitle}" готов!</b>\n\nНажмите кнопку, чтобы отметить свое свободное время.`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: '🚀 Открыть Календарь', 
                            web_app: { url: webAppUrl } 
                        }
                    ]]
                }
            }
        );
    } catch (e: any) {
        console.error(`[TELEGRAM ERROR] ${e.message}`);
        await ctx.reply(`Не удалось создать кнопку. Ошибка: ${e.message}`);
    }
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    if (request.method === 'GET') {
        return response.status(200).json({ status: 'Bot Active', time: new Date().toISOString() });
    }

    try {
        if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing");
        const body = request.body;

        if (!bot.botInfo) {
            if (botInfoCache) {
                bot.botInfo = botInfoCache;
            } else {
                botInfoCache = await bot.telegram.getMe();
                bot.botInfo = botInfoCache;
            }
        }

        await bot.handleUpdate(body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        console.error("[HANDLER ERROR]", e);
        response.status(200).json({ error: e.message });
    }
}
