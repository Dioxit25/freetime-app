import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
// Use environment variables directly to avoid TS unused variable errors
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// YOUR DEPLOYED URL
const WEB_APP_URL = 'https://freetime-app-rho.vercel.app';

// Initial log (Will appear in Vercel Function Logs)
console.log(`[STARTUP] Token Present: ${!!BOT_TOKEN}`);
console.log(`[STARTUP] DB URL Present: ${!!SUPABASE_URL}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Global cache for bot info to prevent repeated API calls in serverless environment
let botInfoCache: any = null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    console.log(`[CMD] /ping from ${ctx.from.id}`);
    await ctx.reply('Pong! 🏓 Я работаю.');
});

bot.start(async (ctx) => {
    console.log(`[CMD] /start from ${ctx.from.id}`);
    const username = ctx.botInfo?.username || 'FreeTimeBot';
    await ctx.reply('Привет! 👋\nЯ помогу найти время для встреч.\n\nДобавьте меня в группу с друзьями, и я создам общий календарь!', 
        Markup.inlineKeyboard([
            Markup.button.url('➕ Добавить в группу', `https://t.me/${username}?startgroup=true`)
        ])
    );
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    console.log(`[EVENT] Member Status Change in ${ctx.chat.id}`);
    const chat = ctx.chat;
    if (chat.type === 'group' || chat.type === 'supergroup') {
        const newMember = (ctx.message as any)?.new_chat_member;
        const myStatus = ctx.myChatMember?.new_chat_member?.status;

        // Initialize if bot is added or status changes to admin/member
        if (newMember?.id === ctx.botInfo.id || myStatus === 'member' || myStatus === 'administrator') {
             await initializeGroup(ctx, chat.id, chat.title);
        }
    }
});

bot.command('init', async (ctx) => {
    console.log(`[CMD] /init in chat: ${ctx.chat.id}`);
    
    if (ctx.chat.type === 'private') {
        return ctx.reply('Команда /init работает только внутри групп. Добавьте меня в группу!');
    }

    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    console.log(`[INIT] Group: ${chatTitle} (${chatId})`);

    if (!supabase) {
        return ctx.reply("⚠️ Ошибка: База данных не подключена.");
    }

    // 1. Register/Update Group in DB (Yes, this creates the group automatically)
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) {
        console.error("[DB ERROR]", error);
        return ctx.reply(`⚠️ Ошибка базы данных: ${error.message}`);
    }

    // 2. Prepare Direct Web App URL
    // passing ?gid=... allows the frontend to read it via URLSearchParams if start_param fails
    const webAppUrl = `${WEB_APP_URL}?gid=${chatId}`;

    // 3. Send Reply with Web App Button
    try {
        await ctx.reply(
            `🗓 <b>Календарь для группы "${chatTitle}" готов!</b>\n\nНажмите кнопку, чтобы отметить свое свободное время.`, 
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('🚀 Открыть Календарь', webAppUrl)]
                ])
            }
        );
    } catch (e: any) {
        console.error(`[TELEGRAM ERROR] ${e.message}`);
    }
}

// --- VERCEL SERVERLESS HANDLER ---
export default async function handler(request: any, response: any) {
    // Diagnostic for browser checks
    if (request.method === 'GET') {
        return response.status(200).json({ 
            status: 'Bot Active', 
            time: new Date().toISOString()
        });
    }

    try {
        if (!BOT_TOKEN) throw new Error("BOT_TOKEN missing");
        const body = request.body;

        // Initialize Bot Info (Fix for Serverless cold starts)
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
