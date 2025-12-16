import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// Initial log (Will appear in Vercel Function Logs)
console.log(`[STARTUP] Token Present: ${!!BOT_TOKEN}`);
console.log(`[STARTUP] DB URL Present: ${!!SUPABASE_URL}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Global cache for bot info
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
        // Checking if bot was added
        const newMember = (ctx.message as any)?.new_chat_member;
        const myStatus = ctx.myChatMember?.new_chat_member?.status;

        if (newMember?.id === ctx.botInfo.id || myStatus === 'member' || myStatus === 'administrator') {
             await initializeGroup(ctx, chat.id, chat.title);
        }
    }
});

bot.command('init', async (ctx) => {
    console.log(`[CMD] /init in chat: ${ctx.chat.id}, type: ${ctx.chat.type}`);
    
    // Explicitly answer if in private chat
    if (ctx.chat.type === 'private') {
        return ctx.reply('Команда /init работает только внутри групп. Добавьте меня в группу!');
    }

    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    console.log(`[INIT] Starting logic for Group: ${chatTitle} (${chatId})`);

    if (!supabase) {
        console.error("[ERROR] Supabase credentials missing");
        return ctx.reply("⚠️ Ошибка: База данных не подключена (проверьте env vars).");
    }

    // 1. Register Group in DB
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) {
        console.error("[DB ERROR]", error);
        return ctx.reply(`⚠️ Ошибка базы данных: ${error.message}`);
    } else {
        console.log(`[DB SUCCESS] Group upserted`);
    }

    // 2. Prepare Link
    const username = ctx.botInfo?.username;
    if (!username) console.warn("[WARN] Bot username is missing in ctx");

    const deepLink = `https://t.me/${username || 'FreeTimeBot'}/app?startapp=gid_${chatId}`;
    console.log(`[LINK] Generated: ${deepLink}`);

    // 3. Send Reply
    try {
        await ctx.reply(
            `🗓 <b>Календарь для группы "${chatTitle}" готов!</b>\n\nНажмите кнопку, чтобы отметить свое свободное время.`, 
            {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('🚀 Открыть Календарь', deepLink)]
                ])
            }
        );
        console.log(`[SUCCESS] Reply sent to ${chatId}`);
    } catch (e: any) {
        console.error(`[TELEGRAM ERROR] Could not reply: ${e.message}`);
    }
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    console.log(`[REQ] Method: ${request.method}`);

    // DIAGNOSTIC ENDPOINT
    if (request.method === 'GET') {
        return response.status(200).json({ 
            status: 'Bot Active', 
            time: new Date().toISOString(),
            env_check: {
                token: !!BOT_TOKEN,
                supabase: !!SUPABASE_URL
            }
        });
    }

    // WEBHOOK HANDLING
    try {
        if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
        
        const body = request.body;
        if (!body) throw new Error("No body provided");

        // Log raw update for debugging
        if (body.message && body.message.text) {
            console.log(`[MSG] Text: "${body.message.text}" from ${body.message.chat.id}`);
        }

        // Initialize Bot Info Cache (Fix for Serverless)
        if (!bot.botInfo) {
            if (botInfoCache) {
                bot.botInfo = botInfoCache;
            } else {
                console.log("[SETUP] Fetching getMe()...");
                botInfoCache = await bot.telegram.getMe();
                bot.botInfo = botInfoCache;
                console.log(`[SETUP] Bot: @${botInfoCache.username}`);
            }
        }

        await bot.handleUpdate(body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        console.error("[HANDLER ERROR]", e);
        response.status(200).json({ error: e.message });
    }
}
