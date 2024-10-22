import express from 'express';
import { validationResult, ValidationChain, Result, ValidationError } from 'express-validator';
import * as _ from 'lodash';

export const validate = (validations: ValidationChain[]) => {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        const errors: Result<ValidationError> = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        res.status(400).send({ success: false, message: _.first(errors.array())!.msg });
    };
};
