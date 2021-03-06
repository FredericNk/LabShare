import { readFileSync, existsSync } from 'fs'
import { FILE_PATH } from './constants'
import Mail from 'nodemailer/lib/mailer'
import { IUserAdmin } from './database/schemas/IUserAdmin'

class EnvVar<T> {
    private _isSet: boolean = false
    value: T

    constructor(evar: Optional<string>, defaultValue: T) {
        this.value = defaultValue

        if (evar && typeof defaultValue === 'string') {
            this._isSet = true
            this.value = <T><unknown>evar
        }
        else if (evar && typeof defaultValue === 'boolean') {
            this._isSet = true
            this.value = <T><unknown>(evar === '1' || evar.toLowerCase() === 'true')
        }
        else if (evar && typeof defaultValue === 'number') {
            this._isSet = true
            try {
                this.value = <T><unknown>parseInt(evar)
            }
            catch(err) {
                console.error("environment variable is not a number!")
                process.exit(1)
            }
        }
    }

    public get isSet(): boolean {
        return this._isSet
    }

    public setIfNotSet(value: T) {
        if (!this._isSet)
            this.value = value
    }
}

class Options {
    private _PRODUCTION: EnvVar<boolean>
    private _STAGING: EnvVar<boolean>
    private _BASE_URL: EnvVar<string>
    private _ENABLE_MAIL: EnvVar<boolean>
    private _DISABLE_DISCORD_BOT: EnvVar<boolean>
    private _DISABLE_VERIFICATION: EnvVar<boolean>    
    private _DISABLE_RATE_LIMITING: EnvVar<boolean>
    private _DOCKER: EnvVar<boolean>
    private _SERVE_STATIC: EnvVar<boolean>
    private _RATE_LIMITING_BLOCK_DURATION: EnvVar<number>

    constructor() {
        // Default values are production configuration
        this._PRODUCTION = new EnvVar(process.env.PRODUCTION, false)
        this._STAGING = new EnvVar(process.env.STAGING, false)

        this._BASE_URL = new EnvVar(process.env.BASE_URL, "https://labhive.de")

        this._ENABLE_MAIL = new EnvVar(process.env.ENABLE_MAIL, true)
        this._DISABLE_DISCORD_BOT = new EnvVar(process.env.DISABLE_DISCORD_BOT, false)

        this._DISABLE_VERIFICATION = new EnvVar(process.env.DISABLE_VERIFICATION, false)
        this._DISABLE_RATE_LIMITING = new EnvVar(process.env.DISABLE_RATE_LIMITING, false)
        this._RATE_LIMITING_BLOCK_DURATION = new EnvVar(process.env.RATE_LIMITING_BLOCK_DURATION, 60)

        // autodetectable on production config, thus the default contig is for development
        this._DOCKER = new EnvVar(process.env.DOCKER, false)
        this._SERVE_STATIC = new EnvVar(process.env.SERVE_STATIC, false)

        if (this.STAGING && this.PRODUCTION) {
            console.error("Invalid configuration, STAGING and PRODUCTION are mutually exclusive options")
            process.exit(1)
        }

        try {
            if (existsSync("/proc/1/cgroup") && readFileSync("/proc/1/cgroup", { encoding: 'utf8' }).indexOf('docker') > -1) {
                console.log("Docker detected!")
                this._DOCKER.value = true
                this._SERVE_STATIC.value = true
            }
        } catch (err) {
            console.error(err)
        }
        

        if (this.STAGING) {
            this._ENABLE_MAIL.setIfNotSet(false)
            this._DISABLE_DISCORD_BOT.setIfNotSet(true)
            this._DISABLE_VERIFICATION.setIfNotSet(true)
            this._DISABLE_RATE_LIMITING.setIfNotSet(true)
            this._RATE_LIMITING_BLOCK_DURATION.setIfNotSet(1)
            this._BASE_URL.setIfNotSet('https://dev.labhive.de')
        }

        if (this.ENABLE_MAIL && !existsSync(FILE_PATH.mailConfig)) {
            console.error("Mail is enabled, but no config exists!")
            console.error("Set the environment variable ENABLE_MAIL to '0' or 'false' to disable the mail sending feature!")
            process.exit(1)
        }

        if (this.PRODUCTION && !existsSync(FILE_PATH.hmacKey)) {
            console.error("Production mode is enabled, but no hmacKey exists!")
            process.exit(1)
        }

        if (!this.DISABLE_DISCORD_BOT && !existsSync(FILE_PATH.discordBotToken)) {
            console.error("Discord Bot is enabled, but no discord token could be found!")
            process.exit(1)
        }
    }

    public get ENABLE_MAIL(): boolean {
        return this._ENABLE_MAIL.value
    }

    public get PRODUCTION(): boolean {
        return this._PRODUCTION.value
    }

    public get STAGING(): boolean {
        return this._STAGING.value
    }

    public get DISABLE_VERIFICATION(): boolean {
        return this._DISABLE_VERIFICATION.value
    }

    public get BASE_URL(): string {
        return this._BASE_URL.value
    }

    public get DISABLE_RATE_LIMITING(): boolean {
        return this._DISABLE_RATE_LIMITING.value
    }

    public get RATE_LIMITING_BLOCK_DURATION(): number {
        return this._RATE_LIMITING_BLOCK_DURATION.value
    }

    public get DISABLE_DISCORD_BOT(): boolean {
        return this._DISABLE_DISCORD_BOT.value
    }

    public get DOCKER(): boolean {
        return this._DOCKER.value
    }

    public get SERVE_STATIC(): boolean {
        return this._SERVE_STATIC.value
    }

    public jsonify() {
        return JSON.stringify(this, null, 4)
    }
}

export let OPT = new Options()

class Configuration {
    HMAC_KEY: string
    MAIL_CONFIG: Mail.Options
    ADMIN_USERS?: IUserAdmin[]
    DISCORD_BOT_TOKEN: string
    DB_CONFIG: {username: string, password: string}

    constructor() {
        this.HMAC_KEY = OPT.PRODUCTION ? readFileSync(FILE_PATH.hmacKey, { encoding: 'utf8' }) : "randomKey"
        this.DISCORD_BOT_TOKEN = !OPT.DISABLE_DISCORD_BOT ? readFileSync(FILE_PATH.discordBotToken, { encoding: 'utf8' }) : ""
        this.MAIL_CONFIG = OPT.ENABLE_MAIL ? JSON.parse(readFileSync(FILE_PATH.mailConfig, { encoding: 'utf8' })) : undefined

        if (!existsSync(FILE_PATH.adminUsers)) {
            console.error("No admin user configuration found!")
            console.error("Create an admin user in secret/adminUsers.json")
        } else {
            this.ADMIN_USERS = JSON.parse(readFileSync(FILE_PATH.adminUsers, { encoding: "utf8" }))
        }

        if (!existsSync(FILE_PATH.dbConfig) && OPT.PRODUCTION) {
            console.error("No DB Config found")
            process.exit(1);
        }
        else {
            this.DB_CONFIG = existsSync(FILE_PATH.dbConfig) ? JSON.parse(readFileSync(FILE_PATH.dbConfig, { encoding: 'utf8' })) : undefined
        }
    }
}

export let CONF = new Configuration()

