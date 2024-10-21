import TelegramBot from 'node-telegram-bot-api';
import { CONFIGS } from './config';

export const bot = new TelegramBot(CONFIGS.ton.token, { polling: true });
