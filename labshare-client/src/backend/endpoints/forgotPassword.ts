import express from "express";
import HttpStatus from 'http-status-codes';
import { v4 as uuid } from 'uuid';
import { Validator as v } from "../../lib/validation";
import { getUserForMail } from '../database/database';
import { ResetToken } from "../database/models";
import utils from '../utils';
import { sendPasswordResetMail } from '../mail/mailer';
import { getLangID } from './language';
import { OPT } from '../options';

interface IBody {
    email?: string
}

export async function forgotPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    let body: IBody = req.body;


    let validationResult = v.validEmail(body.email);
    if (!validationResult.valid || !body.email) {
        return utils.handleError(res, validationResult.err);
    }


    let user = await getUserForMail(body.email, true);
    if (!user) {
        return utils.successResponse(res);
    }

    ResetToken.deleteMany({ objectId: user._id }).exec();

    let token = uuid();
    let token_doc = new ResetToken({ token: token, objectId: user._id });

    
    try {
        await token_doc.save();
        const link = OPT.BASE_URL + "/#/reset-password?token=" + token;
        await sendPasswordResetMail(user!.contact.email, link, getLangID(req));
        return utils.successResponse(res);
    } catch {
        return utils.internalError(res);
    }
}
