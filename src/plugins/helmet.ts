import fp from "fastify-plugin"
import helmet from "@fastify/helmet"

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
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
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": allowedList,
        "script-src-attr": allowedList,
        "connect-src": allowedList,
      },
    },
  }
  console.log("I'm here in helmet")
  fastify.register(helmet, helmetOptions)
})
