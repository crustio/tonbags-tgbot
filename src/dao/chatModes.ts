import { sequelize } from '../db/mysql';
import { ChatMode, DBModel, FileSaveMode } from '../type/model';
import { DataTypes } from 'sequelize';

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
                type: DataTypes.TINYINT,
                allowNull: false,
                field: 'save_mode'
            }
        },
        {
            timestamps: true,
            createdAt: 'create_time',
            updatedAt: 'update_time'
        }
    );
    async upsertMode(chatId: string, saveMode: FileSaveMode) {
        return this.model.upsert({
            chatId,
            saveMode: saveMode
        });
    }
    async getMode(chatId: string): Promise<FileSaveMode> {
        const mode = await this.model.findOne({
            where: {
                chatId
            }
        });
        return mode == null ? FileSaveMode.CRUST : mode!.saveMode;
    }
}

export const ChatModeModel = new Model();
