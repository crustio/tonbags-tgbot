import { DataTypes, Sequelize } from 'sequelize';
import { DBModel, Files } from '../type/model';
import { sequelize } from '../db/mysql';
import { v7 as uuidV7 } from 'uuid';
import { MODE } from '../ton-connect/storage';

class Model implements DBModel<Files> {
    model = sequelize.define<Files>(
        'file',
        {
            id: {
                type: DataTypes.BIGINT,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            uuid: {
                type: DataTypes.STRING(64),
                allowNull: false,
                field: 'uuid',
                unique: true
            },
            address: {
                type: DataTypes.STRING(96),
                allowNull: false,
                field: 'address'
            },
            from: {
                type: DataTypes.STRING(128),
                allowNull: false,
                field: 'from'
            },
            fileName: {
                type: DataTypes.TEXT,
                allowNull: false,
                field: 'file_name'
            },
            file: {
                type: DataTypes.TEXT,
                allowNull: false,
                field: 'file'
            },
            fileSize: {
                type: DataTypes.BIGINT,
                allowNull: false,
                field: 'file_size'
            },
            uploadDate: {
                type: DataTypes.DATE,
                allowNull: false,
                field: 'upload_date',
                defaultValue: Sequelize.fn('NOW')
            },
            saveMode: {
                type: DataTypes.STRING(16),
                allowNull: false,
                field: 'save_mode',
                defaultValue: ''
            },
            cid: {
                type: DataTypes.STRING(128),
                allowNull: true
            },
            bagId: {
                type: DataTypes.STRING(128),
                allowNull: true,
                field: 'bag_id'
            }
        },
        {
            timestamps: false
        }
    );
    async queryFilePageByAddress(
        address: string,
        page: number,
        pageSize: number
    ): Promise<Files[]> {
        return await this.model.findAll({
            where: { address },
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: [['upload_date', 'DESC']]
        });
    }
    async queryFileCountAndTotalSizeByAddress(
        address: string
    ): Promise<{ count: number; totalFileSize: number }> {
        const result = await this.model.findOne({
            attributes: [
                [Sequelize.fn('COUNT', Sequelize.col('*')), 'count'],
                [Sequelize.fn('SUM', Sequelize.col('file_size')), 'totalFileSize']
            ],
            where: {
                address
            }
        });
        return {
            count: result!.get('count') as number,
            totalFileSize: Number(result!.get('totalFileSize') ?? 0)
        };
    }
    async createFile(file: {
        chatId: string;
        address: string;
        from: string;
        fileName: string;
        file: string;
        fileSize: bigint;
        saveMode: MODE;
        cid?: string;
        bagId?: string;
    }) {
        return await this.model.create({
            ...file,
            uuid: uuidV7(),
            uploadDate: new Date(),
            id: undefined
        });
    }
}

export const FileModel = new Model();
