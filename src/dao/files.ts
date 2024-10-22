import { DataTypes, Sequelize } from 'sequelize';
import { DBModel, Files, FileSaveMode } from '../type/model';
import { sequelize } from '../db/mysql';

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
            saveType: {
                type: DataTypes.TINYINT,
                allowNull: false,
                field: 'save_type',
                defaultValue: FileSaveMode.CRUST
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
    async createFile(file: Files) {
        return await this.model.create({
            ...file,
            uploadDate: new Date(),
            id: undefined
        });
    }
}

export const FileModel = new Model();
