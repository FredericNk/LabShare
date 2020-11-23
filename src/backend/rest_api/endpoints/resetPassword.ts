import argon2 from "argon2";
import express from "express";
import { getUser } from '../../lib/database/database';
import { ResetToken } from "../../lib/database/models";
import JsonSchema, { schemas } from "../jsonSchemas/JsonSchema";
import utils from '../utils';
import { BAD_REQUEST } from 'http-status-codes';

interface IBody {
    newPassword?: string
}

export async function resetPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    let body: IBody = req.body;
    let token = typeof req.query.token === 'string' ? req.query.token : undefined

    if (!JsonSchema.validate(body, schemas.password_reset) || !token || !body.newPassword) {
        return utils.badRequest(res);
    }
    
    let token_doc = await ResetToken.findOneAndDelete({ token: token }).exec();
    if (!token_doc) {
        return utils.badRequest(res);
    }

    let oldest = new Date()
    oldest.setDate(oldest.getDate() - 2)
    if (token_doc.createdAt < oldest) {
        return utils.errorResponse(res, BAD_REQUEST, "tokenTooOld")
    }
    
    let password = await argon2.hash(body.newPassword);
    let user = await getUser({ _id: token_doc.objectId });
    if (!user) {
        return utils.internalError(res);
    }
    
    user.password = password;
    user.save(undefined).then((doc) => {
        if (!doc) {
            return utils.internalError(res);
        }
        utils.successResponse(res);
    }).catch(err => {
        console.log(err);
        return utils.internalError(res);
    });
}
