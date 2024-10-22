import { Model, ModelStatic } from 'sequelize';
import { MODE } from '../ton-connect/storage';

export interface DBModel<T extends Model> {
    model: ModelStatic<T>;
}

export class Files extends Model {
    public id!: number;
    public uuid!: string;
    public chatId!: string;
    public address!: string;
    public from!: string;
    public fileName!: string;
    public file!: string;
    public fileSize!: bigint;
    public uploadDate!: Date;
    public saveMode!: MODE;
    public cid?: string;
    public bagId?: string;
}

export class ChatMode extends Model {
    public id!: number;
    public chatId!: string;
    public saveMode!: MODE;
    public createTime?: Date;
    public updateTime?: Date;
}
