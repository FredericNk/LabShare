import mongoose, { Model, Document, DocumentQuery } from "mongoose"
import { IUserVolunteer, UserVolunteerSchema } from './schemas/IUserVolunteer'
import { IUserLabDiag, UserLabDiagSchema } from './schemas/IUserLabDiag'
import { IResetToken, ResetTokenSchema } from './schemas/IResetToken'
import { IUserCommon, UserCommonSchema } from './schemas/IUserCommon'
import { UserLabResearchSchema, IUserLabResearch } from './schemas/IUserLabResearch'
import { UserRoles } from '../../lib/userRoles'
import { FailedMailSchema, IFailedMail } from './schemas/IFailedMail'
import { ActivationTokenSchema, IActivationToken } from './schemas/IActivationToken'
import { UserAdminSchema, IUserAdmin } from './schemas/IUserAdmin'
import { CONF } from '../options'
import { TESTS_PER_WEEK, GlobalEvent } from '../constants';
import { Token } from '../utils'
import { status } from "migrate-mongo"

const connectionBase = process.env.PRODUCTION ? 'mongodb' : 'localhost';
export let ready = false;

mongoose.connect(`mongodb://${connectionBase}:27017/labshare`, { useNewUrlParser: true }).then(async () => {
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

    let migrated = false
    while (!migrated) {
        const s = await status(mongoose.connection.db)
        const pendingMigrations = s.filter((x => x.appliedAt === "PENDING")).map(x => { return `PENDING Migration: ${x.fileName}` })

        if (pendingMigrations.length == 0) {
            migrated = true
        }
        else {
            console.warn(pendingMigrations.join("\n"))
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    ready = true;
    GlobalEvent.emit("ready")
}).catch((err) => {
    console.error(err)
    process.exit(1)
})


export const UserAdmin = mongoose.model<IUserAdmin>('user_admin', UserAdminSchema)

export const UserCommon = mongoose.model<IUserCommon>('users', UserCommonSchema)
export const UserVolunteer = UserCommon.discriminator<IUserVolunteer>(UserRoles.VOLUNTEER, UserVolunteerSchema)
export const UserLabDiag = UserCommon.discriminator<IUserLabDiag>(UserRoles.LAB_DIAG, UserLabDiagSchema)
export const UserLabResearch = UserCommon.discriminator<IUserLabResearch>(UserRoles.LAB_RESEARCH, UserLabResearchSchema)

export const ResetToken = mongoose.model<IResetToken>('reset_token', ResetTokenSchema)
export const FailedMail = mongoose.model<IFailedMail>('failed_mail', FailedMailSchema)
export const ActivationToken = mongoose.model<IActivationToken>('activation_token', ActivationTokenSchema)


export function getUserForMail(email: string, lean: boolean = false): Promise<Optional<IUserCommon>> {
    return getUser({ 'contact.email': email }, lean);
}

export function getUserById(id: string, lean: boolean = false): Promise<Optional<IUserCommon>> {
    return getUser({ _id: id }, lean);
}

export function getModelForRole(role?: string): Optional<Model<IUserCommon>> {
    switch (role) {
        case UserRoles.LAB_DIAG:
            return UserLabDiag;
        case UserRoles.LAB_RESEARCH:
            return UserLabResearch;
        case UserRoles.VOLUNTEER:
            return UserVolunteer;
        default:
            return UserCommon;
    }
}

export async function getUser(filter: any, lean: boolean = false): Promise<Optional<IUserCommon>> {
    let query = UserCommon.findOne(filter)
    if (lean)
        query.lean()
    return (await query.exec()) ?? undefined
}

export async function getUserOrAdmin(filter: any, lean: boolean = false): Promise<Optional<IUserCommon>> {
    let models: Model<any>[] = [UserCommon, UserAdmin]

    for (let i of models) {
        let tmp = i.findOne(filter)
        if (lean)
            tmp = tmp.lean()

        let res = await tmp.exec()
        if (res) {
            return res
        }
    }

    return undefined
}

export async function getTestCoverage(): Promise<{
    testsPerWeek: number;
    markerCounts: { [index in UserRoles]: number };
    markers: Array<{
        role: UserRoles;
        latLong: { lat: number; long: number };
    }>;
}> {

    let filter = getFilterForPublicUsers()

    const users = await UserCommon.find(filter).select({ __t: 1, location: 1, role: 1 }).lean().exec()


    const labDiags = users.filter((i) => i.__t == UserRoles.LAB_DIAG)
    const labResearches = users.filter((i) => i.__t == UserRoles.LAB_RESEARCH)
    const volunteers = users.filter((i) => i.__t == UserRoles.VOLUNTEER)

    return {
        testsPerWeek: TESTS_PER_WEEK,
        markerCounts: {
            [UserRoles.LAB_DIAG]: labDiags.length,
            [UserRoles.LAB_RESEARCH]: labResearches.length,
            [UserRoles.VOLUNTEER]: volunteers.length
        },
        markers: [...labDiags, ...labResearches, ...volunteers].map(
            ({ role, location }) => ({
                role,
                latLong: {
                    lat: location.coordinates[1],
                    long: location.coordinates[0]
                }
            })
        )
    };
}






export function getFilterForPublicUsers(additional: any = {}): any {
    return {
        'consent.publicSearch': true,
        'verified.manually': true,
        'verified.mail': true,
        'disabled': false,
        ...additional
    }
}

export function cleanUserObjForToken(token: Optional<Token>, user: IUserCommon) {
    delete user._id
    delete user.__v
    delete user.password
    delete user.consent
    delete user.verified
    delete user.disabled

    // unauthorized or logged in as volunteer
    if (!token || (token && token.role === UserRoles.VOLUNTEER)) {
        delete user.contact

        if (user.role === UserRoles.VOLUNTEER) {
            delete user.organization
            delete user.website
        }
    }
}

export function sensibleUserProjection(): { [key: string]: number } {
    return {
        'location': 1,
        'address': 1,
        'description': 1,
        'role': 1,
        'offers': 1,
        'lookingFor': 1,
        'organization': 1,
        'website': 1,
        'contact': 1,
        'details': 1,
        'slug': 1
    }
}