import fp from "fastify-plugin"
import helmet from "@fastify/helmet"

/**
 * This plugins adds helmet header protection
 *
 * @see https://github.com/fastify/fastify-helmet
 */
export default fp<any>(async fastify => {
  const allowedList = [
    "'self'",
    "*.msauth.net",
    "*.microsoftonline.com",
    "*.microsoftonline.us",
    "*.microsoft.com",
    "*.msftauth.net",
    "*.jsdelivr.net",
    "*.cloudflare.com",
    "unpkg.com",
    "'unsafe-inline'",
    "'unsafe-eval'",
  ]
  const helmetOptions = {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": allowedList,
        "script-src-attr": allowedList,
        "connect-src": allowedList,
      },
    },
  }
  console.log("I'm here in helmet")
  // console.log("I'm here in helmet", JSON.stringify(helmetOptions, null, 2))
  fastify.register(helmet, helmetOptions)
})
