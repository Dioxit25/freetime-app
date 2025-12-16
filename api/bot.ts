import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL; 

// Initial log to Vercel console
console.log(`[BOT STARTUP] Token: ${!!BOT_TOKEN}, DB: ${!!SUPABASE_URL}, WebApp: ${WEB_APP_URL}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// Global var to cache bot info across hot lambda invocations
let botInfoCache: any = null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    console.log(`[PING] from ${ctx.from.id}`);
    await ctx.reply('Pong! 🏓 Bot is active.');
});

bot.start((ctx) => {
    const username = ctx.botInfo?.username || 'FreeTimeBot';
    ctx.reply('Привет! 👋\nЯ помогу найти время для встреч.\n\nДобавьте меня в группу с друзьями, и я создам общий календарь!', 
        Markup.inlineKeyboard([
            Markup.button.url('➕ Добавить в группу', `https://t.me/${username}?startgroup=true`)
        ])
    );
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    try {
        const chat = ctx.chat;
        const newStatus = ctx.myChatMember?.new_chat_member?.status;
        console.log(`[EVENT] Chat Member Update: ${chat.id} status: ${newStatus}`);
        
        // Ignore leaving events
        if (newStatus === 'left' || newStatus === 'kicked') return;

        // Only act in groups
        if (chat.type === 'group' || chat.type === 'supergroup') {
            await initializeGroup(ctx, chat.id, chat.title);
        }
    } catch (e) {
        console.error("Error in my_chat_member:", e);
    }
});

bot.command('init', async (ctx) => {
    console.log(`[CMD] /init in ${ctx.chat.id} (${ctx.chat.type})`);
    if (ctx.chat.type === 'private') return ctx.reply('Эту команду нужно писать внутри группы.');
    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) {
        console.error("Supabase is missing!");
        return ctx.reply("⚠️ Ошибка: База данных не подключена.");
    }

    console.log(`[INIT GROUP] Attempting to register ${chatId} - ${chatTitle}`);
    
    // 1. Register Group
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    });

    if (error) {
        console.error("[DB ERROR]", error);
        return ctx.reply(`⚠️ Ошибка БД: ${error.message}`);
    }

    // Ensure we have a username. If for some reason ctx.botInfo is missing, fallback to empty (link might break but won't crash)
    const username = ctx.botInfo?.username;
    if (!username) {
        console.error("CRITICAL: ctx.botInfo is missing. Link will be broken.");
    }
    
    // 2. Generate Guaranteed Link (Deep Link)
    const deepLink = `https://t.me/${username}/app?startapp=gid_${chatId}`;

    await ctx.reply(
        `🗓 <b>Календарь создан!</b>\n\nГруппа: ${chatTitle}\nНажмите кнопку ниже, чтобы отметить свободное время.`, 
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url('🚀 Открыть Календарь', deepLink)]
            ])
        }
    );
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    // DIAGNOSTIC ENDPOINT (GET)
    if (request.method === 'GET') {
        return response.status(200).json({ 
            status: 'Bot is running',
            env: {
                hasToken: !!BOT_TOKEN,
                hasDBUrl: !!SUPABASE_URL,
                hasDBKey: !!SUPABASE_KEY,
                webAppUrl: WEB_APP_URL || 'Not Set'
            }
        });
    }

    // WEBHOOK ENDPOINT (POST)
    if (!BOT_TOKEN) {
        console.error("BOT_TOKEN is missing in Vercel Env Vars");
        return response.status(500).json({ error: 'No Token' });
    }

    try {
        // Log incoming update type for debugging
        if (request.body && request.body.message) {
            console.log(`[UPDATE] Msg: ${request.body.message.text} from ${request.body.message.chat.id}`);
        } else if (request.body && request.body.my_chat_member) {
            console.log(`[UPDATE] Chat Member Status Change`);
        }

        // Initialize bot info if missing (CRITICAL for Deep Linking in Vercel)
        if (!bot.botInfo) {
            if (botInfoCache) {
                bot.botInfo = botInfoCache;
            } else {
                try {
                    console.log("[INFO] Fetching getMe()...");
                    botInfoCache = await bot.telegram.getMe();
                    bot.botInfo = botInfoCache;
                    console.log(`[INFO] Bot username: ${botInfoCache.username}`);
                } catch (e) {
                    console.error("Failed to fetch bot info:", e);
                }
            }
        }

        await bot.handleUpdate(request.body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        console.error("Bot Handle Error:", e);
        response.status(200).json({ error: e.message });
    }
}
