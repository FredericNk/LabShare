import mongoose, { Model } from "mongoose"
import { IUserVolunteer, UserVolunteerSchema } from './schemas/IUserVolunteer'
import { IUserLabDiag, UserLabDiagSchema } from './schemas/IUserLabDiag'
import { IResetToken, ResetTokenSchema } from './schemas/IResetToken'
import { IUserCommon } from './schemas/IUserCommon'
import { UserLabResearchSchema, IUserLabResearch } from './schemas/IUserLabResearch'
import { UserRoles } from '../../lib/userRoles'
import { FailedMailSchema, IFailedMail } from './schemas/IFailedMail'
import { ActivationTokenSchema, IActivationToken } from './schemas/IActivationToken'
import { UserAdminSchema, IUserAdmin } from './schemas/IUserAdmin'
import { CONF } from '../options'


let promise: Promise<any>
if (!process.env.PRODUCTION) {
    promise = mongoose.connect("mongodb://localhost:27017/labshare", { useNewUrlParser: true })
} else {
    promise = mongoose.connect("mongodb://mongodb:27017/labshare", { useNewUrlParser: true })
}

promise.then(async () => {
    if (CONF.ADMIN_USER) {
        let mail = CONF.ADMIN_USER.contact.email
        let user = await UserAdmin.findOne({ 'contact.email': mail }).exec()
        if (!user) {
            let admin = new UserAdmin(CONF.ADMIN_USER)
            return admin.save().then((doc) => {
                if (!doc)
                    throw new Error("nothing saved")
            })
        }
    }
    return
}).catch((err) => {
    console.error(err)
    process.exit(1)
})


export const UserAdmin = mongoose.model<IUserAdmin>('user_admin', UserAdminSchema)
export const UserVolunteer = mongoose.model<IUserVolunteer>('user_volunteer', UserVolunteerSchema)
export const UserLabDiag = mongoose.model<IUserLabDiag>('user_labDiag', UserLabDiagSchema)
export const UserLabResearch = mongoose.model<IUserLabResearch>('user_labResearch', UserLabResearchSchema)
export const ResetToken = mongoose.model<IResetToken>('reset_token', ResetTokenSchema)
export const FailedMail = mongoose.model<IFailedMail>('failed_mail', FailedMailSchema)
export const ActivationToken = mongoose.model<IActivationToken>('activation_token', ActivationTokenSchema)


export function getUserForMail(email: string, includeAdmin: boolean = false): Promise<Optional<IUserCommon>> {
    return getUser({ "contact.email": email }, includeAdmin)
}

export function getUserById(id: string, includeAdmin: boolean = false): Promise<Optional<IUserCommon>> {
    return getUser({_id: id}, includeAdmin)
}

export function getModelForRole(role: string): Optional<Model<IUserCommon>> {
    switch (role) {
        case UserRoles.LAB_DIAG:
            return UserLabDiag
        case UserRoles.LAB_RESEARCH:
            return UserLabResearch
        case UserRoles.VOLUNTEER:
            return UserVolunteer;
        default:
            console.log("Cannot get database model for role " + role)
            return undefined
    }
}

export async function getUser(filter: any, includeAdmin: boolean = false): Promise<Optional<IUserCommon>> {
    let models: Model<any>[] = [UserLabResearch, UserLabDiag, UserVolunteer]
    if (includeAdmin) {
        models.push(UserAdmin)
    }
    let matches = []

    for (let i of models) {
        try {
            let match = await i.findOne(filter).exec()
            if (match) {
                matches.push(match)
            }
        } catch {
            return undefined
        }
    }

    if (matches.length > 1) {
        throw new Error("More than one result found.")
    } else if (matches.length == 0) {
        return undefined
    } else {
        return matches[0]
    }
}

