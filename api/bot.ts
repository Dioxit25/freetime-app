import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

// IMPORTANT: Must EXACTLY match BotFather (including the trailing slash!)
const WEB_APP_URL = 'https://freetime-app-rho.vercel.app/';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// --- COMMANDS ---

bot.command('ping', async (ctx) => {
    await ctx.reply('Pong! 🏓 Бот работает в штатном режиме.');
});

bot.command('help_setup', async (ctx) => {
    await ctx.reply(
        `🛠 <b>Настройка прямого доступа:</b>\n\n` +
        `Если кнопка в группе не открывает приложение, убедитесь, что в @BotFather в разделе "Edit Web App" указан именно этот URL:\n` +
        `<code>${WEB_APP_URL}</code>`,
        { parse_mode: 'HTML' }
    );
});

bot.start(async (ctx) => {
    const me = await bot.telegram.getMe();
    await ctx.reply('Привет! 👋\nЯ помогу вашей компании выбрать время для встречи.\n\nДобавьте меня в группу, чтобы создать общий календарь!', {
        reply_markup: {
            inline_keyboard: [[
                { text: '➕ Добавить в группу', url: `https://t.me/${me.username}?startgroup=true` }
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
    if (!supabase) return ctx.reply("⚠️ Ошибка: Supabase не подключен.");

    // Регистрируем группу в БД
    const { error } = await supabase.from('groups').upsert({
        id: chatId,
        title: chatTitle,
        tier: 'FREE'
    }, { onConflict: 'id' });

    if (error) return ctx.reply(`❌ Ошибка БД: ${error.message}`);

    // Формируем URL. Знак '?' идет сразу после слеша.
    // Это гарантирует, что Telegram сочтет URL валидным для данного бота.
    const directUrl = `${WEB_APP_URL}?gid=${chatId}`;

    try {
        await ctx.reply(
            `🗓 <b>Общий календарь для "${chatTitle}"</b>\n\nНажмите кнопку ниже, чтобы открыть приложение прямо в этом чате.`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { 
                            text: '🚀 Открыть Календарь', 
                            web_app: { url: directUrl } 
                        }
                    ]]
                }
            }
        );
    } catch (e: any) {
        console.error("Critical Button Error:", e.message);
        // Если кнопка все равно не проходит валидацию Telegram, выводим техническую ошибку для админа
        await ctx.reply(
            `❌ <b>Ошибка конфигурации кнопок.</b>\n\n` +
            `Telegram отклонил кнопку web_app. Убедитесь, что URL в BotFather в точности совпадает с:\n` +
            `<code>${WEB_APP_URL}</code>`,
            { parse_mode: 'HTML' }
        );
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
        console.error("Webhook handler error:", e.message);
        response.status(200).json({ error: e.message });
    }
}
