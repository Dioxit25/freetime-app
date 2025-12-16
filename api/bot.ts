import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
const WEB_APP_URL = process.env.WEB_APP_URL; 

console.log(`[BOT INIT] Token: ${!!BOT_TOKEN}, DB: ${!!SUPABASE_URL}, WebApp: ${WEB_APP_URL}`);

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓 Bot is active.');
});

bot.start((ctx) => {
    ctx.reply('Привет! 👋\nЯ помогу найти время для встреч.\n\nДобавьте меня в группу с друзьями, и я создам общий календарь!', 
        Markup.inlineKeyboard([
            Markup.button.url('➕ Добавить в группу', `https://t.me/${ctx.botInfo.username}?startgroup=true`)
        ])
    );
});

// --- GROUP LOGIC ---

bot.on(['my_chat_member', 'new_chat_members'], async (ctx) => {
    try {
        const chat = ctx.chat;
        const newStatus = ctx.myChatMember?.new_chat_member?.status;
        
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
    if (ctx.chat.type === 'private') return ctx.reply('Эту команду нужно писать внутри группы.');
    await initializeGroup(ctx, ctx.chat.id, ctx.chat.title);
});

async function initializeGroup(ctx: any, chatId: number, chatTitle: string) {
    if (!supabase) return ctx.reply("⚠️ Ошибка: База данных не подключена.");

    console.log(`[INIT GROUP] ${chatId} - ${chatTitle}`);
    
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

    // 2. Generate Guaranteed Link (Deep Link)
    // Using t.me link forces Telegram to handle the start_param correctly on all devices
    const deepLink = `https://t.me/${ctx.botInfo.username}/app?startapp=gid_${chatId}`;

    // 3. Generate Direct Link with Hash (Backup)
    // Hash (#) survives server-side redirects better than Query (?)
    const webLink = `${WEB_APP_URL}#gid=${chatId}`;

    await ctx.reply(
        `🗓 <b>Календарь создан!</b>\n\nГруппа: ${chatTitle}\nНажмите кнопку ниже, чтобы отметить свободное время.`, 
        {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                // Primary Button: Uses t.me link. 
                // This will open the app and GUARANTEE start_param is passed.
                [Markup.button.url('🚀 Открыть Календарь', deepLink)],
                
                // Secondary/Debug Button (Optional, can be removed if confusing)
                // [Markup.button.webApp('🌐 Web Version', webLink)] 
            ])
        }
    );
}

// --- VERCEL HANDLER ---
export default async function handler(request: any, response: any) {
    if (request.method === 'GET') return response.status(200).send('Bot is running.');
    if (!BOT_TOKEN) return response.status(500).json({ error: 'No Token' });
    try {
        await bot.handleUpdate(request.body);
        response.status(200).json({ ok: true });
    } catch (e: any) {
        console.error(e);
        response.status(200).json({ error: e.message });
    }
}
