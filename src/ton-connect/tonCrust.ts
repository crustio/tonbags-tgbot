// @ts-nocheck
import { TonProofItemReplySuccess, Wallet } from '@tonconnect/sdk';
import { createHash } from 'crypto';
import { numberToBytes } from 'viem';
interface Domain {
    LengthBytes: number; // uint32 `json:"lengthBytes"`
    Value: string; // string `json:"value"`
}

interface ParsedMessage {
    Workchain: number; // int32
    Address: Buffer; // []byte
    Timstamp: number; // int64
    Domain: Domain; // Domain
    Signature: Buffer; // []byte
    Payload: string; // string
    StateInit: string; // string
}
const tonProofPrefix = 'ton-proof-item-v2/';
const tonConnectPrefix = 'ton-connect';

export async function CreateMessage(message: ParsedMessage): Promise<Buffer> {
    const wc = Buffer.from(numberToBytes(message.Workchain, { size: 4 }));
    const ts = Buffer.from(numberToBytes(message.Timstamp, { size: 8 }).reverse());
    const dl = Buffer.from(numberToBytes(message.Domain.LengthBytes, { size: 4 }).reverse());

    const m = Buffer.concat([
        Buffer.from(tonProofPrefix),
        wc,
        message.Address,
        dl,
        Buffer.from(message.Domain.Value),
        ts,
        Buffer.from(message.Payload)
    ]);
    // @ts-ignore
    const messageHash = createHash('sha256').update(m).digest();
    const fullMes = Buffer.concat([
        Buffer.from([0xff, 0xff]),
        Buffer.from(tonConnectPrefix),
        Buffer.from(messageHash)
    ]);
    // []byte{0xff, 0xff}
    // fullMes = append(fullMes, []byte(tonConnectPrefix)...)
    // fullMes = append(fullMes, messageHash[:]...)

    // const res = await crypto.subtle.digest('SHA-256', fullMes)
    // @ts-ignore
    const res = createHash('sha256').update(fullMes).digest();
    return Buffer.from(res);
}

export async function createCrustAuth(wallet: Wallet) {
    const [workChain, hash] = wallet.account.address.split(':') as [string, string];
    const proof = (wallet.connectItems!.tonProof! as TonProofItemReplySuccess).proof;
    const parsed: ParsedMessage = {
        Workchain: Number(workChain),
        Address: Buffer.from(hash, 'hex'),
        Domain: {
            LengthBytes: proof.domain.lengthBytes,
            Value: proof.domain.value
        },
        Signature: Buffer.from(proof.signature, 'base64'),
        Payload: proof.payload,
        StateInit: wallet.account.walletStateInit,
        Timstamp: proof.timestamp
    };
    const message = await CreateMessage(parsed);
    const hexData = message.toString('hex');
    const signature = proof.signature;
    const perSignData = `ton-${wallet.account.publicKey}-${hexData}:${signature}`;
    const base64Signature = btoa(perSignData);
    const authBasic = `${base64Signature}`;
    return authBasic;
}
