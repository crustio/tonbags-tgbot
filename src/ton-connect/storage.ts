import { IStorage } from '@tonconnect/sdk';
import { createClient } from 'redis';
import { CONFIGS } from '../config';
import { ChatModeModel } from '../dao/chatModes';

const client = createClient({ url: CONFIGS.redis.url });

client.on('error', err => console.log('Redis Client Error', err));

export async function initRedisClient(): Promise<void> {
    await client.connect();
}
export class TonConnectStorage implements IStorage {
    constructor(private readonly chatId: number) {}

    private getKey(key: string): string {
        return this.chatId.toString() + key;
    }

    async removeItem(key: string): Promise<void> {
        await client.del(this.getKey(key));
    }

    async setItem(key: string, value: string): Promise<void> {
        await client.set(this.getKey(key), value);
    }

    async getItem(key: string): Promise<string | null> {
        return (await client.get(this.getKey(key))) || null;
    }
}

export type MODE = '' | 'ton' | 'crust';

export async function getMode(chatId: number): Promise<MODE> {
    let mode = await client.get(`storage_mode_${chatId}`);
    if (!mode) {
        mode = await ChatModeModel.getMode(`${chatId}`);
        await client.set(`storage_mode_${chatId}`, mode);
    }
    return mode as MODE;
}

export async function setMode(chatId: number, mode: MODE): Promise<void> {
    await ChatModeModel.upsertMode(`${chatId}`, mode);
    await client.set(`storage_mode_${chatId}`, mode);
}

export async function setAuth(chatId: number, auth?: string | null) {
    if (!auth) {
        await client.del(`auth_${chatId}`);
    } else {
        await client.set(`auth_${chatId}`, auth);
    }
}

export async function getAuth(chatId: number) {
    const auth = await client.get(`auth_${chatId}`);
    return auth;
}
