import dotenv from "dotenv";
if (!process.env.PRODUCTION)
  dotenv.config()
import cors from 'cors'
import express from "express"
import { NOT_FOUND, UNAUTHORIZED } from 'http-status-codes'
import { activate } from './endpoints/activate'
import { AdminEndpoint } from './endpoints/admin'
import { changePassword } from './endpoints/changePassword'
import { forgotPassword } from './endpoints/forgotPassword'
import { language } from './endpoints/language'
import { login } from './endpoints/login'
import TestCapacity from './endpoints/TestCapacity'
import Profile from './endpoints/Profile'
import { registration } from './endpoints/registration'
import { resetPassword } from './endpoints/resetPassword'
import { search } from "./endpoints/search"
import { testCoverage } from './endpoints/testCoverage'
import { UnauthorizedError } from 'lib/errors'
import { authMiddleware } from './middlewares/auth'
import { OPT } from './config/options'
import utils from './utils'
import { connect } from 'backend/lib/database/database'
import { RateLimiter } from './ratelimiter'


connect().then(() => {
  main()
})

function main() {
  let app = express()
  let router = express.Router()
  let adminRouter = new AdminEndpoint(express.Router())

  if (OPT.STAGING) {
    app.use((req, res, next) => {
      res.setHeader("X-Robots-Tag", "noindex")
      next()
    })
    app.get("/robots.txt", (req, res) => {
      res.setHeader("Content-Type", "text/plain")
      res.send("User-agent: *\nDisallow: /")
    })
  }

  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'deny')
    next()
  })

  if (OPT.DOCKER || OPT.SERVE_STATIC) {
    app.use(express.static('dist'));
    app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'])
  } else {
    app.use(cors());
  }

  app.use(express.json());
  app.use('/api/v1', router)

  router.use(function(req, res, next) {
      RateLimiter.consume(req.ip)
          .then(() => {
              next();
          })
          .catch(_ => {
              if (OPT.DISABLE_RATE_LIMITING) {
                  return next()
              }
              return utils.errorResponse(res, 429, "Too many requests")
          });
  })

  router.use('/admin', adminRouter.router)
  if (OPT.STAGING) {
    router.get('/debug', (req, res) => {
      res.contentType('text/plain')
      res.send(
        `Time: ${new Date()}\n`+
        `IP: ${req.ip}\n` +
        `Headers: ${JSON.stringify(req.headers, null, 4)}\n` + 
        `OPT: ${OPT.jsonify()}\n`
      )
    })
  }



  router.get('/language', language)
  router.post('/registration', registration)
  router.post('/forgot-password', forgotPassword)
  router.post("/reset-password", resetPassword)
  router.post("/login", login)
  router.get("/search", search)
  router.post("/activate", activate)
  router.get("/test-coverage", testCoverage)
  router.get("/profile/:id", Profile.getForSlug)
  router.post("/profile/:id/updateAvailability", Profile.updateAvailability)


  router.use(authMiddleware)

  router.post("/change-password", changePassword)
  router.post("/profile/revoke", Profile.revoke)
  router.get("/profile", Profile.get)
      .post("/profile", Profile.post)
      .post("/profile/:id/notAvailableNotice", Profile.notAvailableNotice)
      .delete("/profile", Profile.delete)
  router.get("/testCapacity", TestCapacity.get)
  router.get("/testCapacity/query", TestCapacity.query)
  router.post("/testCapacity", TestCapacity.update)


  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    return utils.errorResponse(res, NOT_FOUND, "invalid_route")
  })

  app.use(function(err: Error, req: express.Request, res: express.Response, next: express.NextFunction) {
    if (err instanceof UnauthorizedError) {
      return utils.errorResponse(res, UNAUTHORIZED, "not_authorized");
    }

    return utils.errorResponse(res, NOT_FOUND, "invalid_route")
  });

  app.listen(5000, function () {
    console.log('Example app listening on port 5000!')
  })
}
