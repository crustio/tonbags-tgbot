import { Model, ModelStatic } from 'sequelize';

export interface DBModel<T extends Model> {
    model: ModelStatic<T>;
}

export enum FileSaveMode {
    CRUST = 0,
    TON_STORAGE = 1
}

export class Files extends Model {
    public id!: number;
    public uuid!: string;
    public address!: string;
    public from!: string;
    public fileName!: string;
    public file!: string;
    public fileSize!: bigint;
    public uploadDate!: Date;
    public saveType!: number;
    public cid?: string;
    public bagId?: string;
}

export class ChatMode extends Model {
    public id!: number;
    public chatId!: string;
    public saveMode!: number;
    public createTime?: Date;
    public updateTime?: Date;
}
