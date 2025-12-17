import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

const WEB_APP_BASE = 'https://freetime-app-rho.vercel.app/';

const bot = new Telegraf(BOT_TOKEN || 'MISSING_TOKEN');
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

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

// Единый обработчик добавления бота в группу
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
        // Регистрируем группу
        await supabase.from('groups').upsert({
            id: chatId,
            title: chatTitle,
            tier: 'FREE'
        }, { onConflict: 'id' });

        const appLink = `${WEB_APP_BASE}?gid=${chatId}`;
        
        // Отправляем ОДНО сообщение
        await ctx.reply(
            `🗓 <b>Календарь для "${chatTitle}" готов!</b>\n\nНажимайте на кнопку ниже, чтобы отметить время, когда вы заняты.`, 
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🚀 Открыть Календарь', url: appLink }
                    ]]
                }
            }
        );
    } catch (e) {
        console.error("Init error:", e);
    }
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
