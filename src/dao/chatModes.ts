import { sequelize } from '../db/mysql';
import { ChatMode, DBModel } from '../type/model';
import { DataTypes } from 'sequelize';
import { MODE } from '../ton-connect/storage';

class Model implements DBModel<ChatMode> {
    model = sequelize.define<ChatMode>(
        'chat_mode',
        {
            id: {
                type: DataTypes.BIGINT,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            chatId: {
                type: DataTypes.STRING(96),
                allowNull: false,
                field: 'chat_id',
                unique: true
            },
            saveMode: {
                type: DataTypes.STRING(16),
                allowNull: false,
                field: 'save_mode',
                defaultValue: ''
            }
        },
        {
            timestamps: true,
            createdAt: 'create_time',
            updatedAt: 'update_time'
        }
    );
    async upsertMode(chatId: string, saveMode: MODE) {
        return this.model.upsert({
            chatId,
            saveMode: saveMode
        });
    }
    async getMode(chatId: string): Promise<MODE | ''> {
        const mode = await this.model.findOne({
            where: {
                chatId
            }
        });
        return mode == null ? '' : mode!.saveMode;
    }
}

export const ChatModeModel = new Model();
