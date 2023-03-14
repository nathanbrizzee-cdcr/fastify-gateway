import fp from "fastify-plugin"
import cors from "@fastify/cors"

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default fp<any>(async fastify => {
  console.log("I'm here in cors")
  fastify.register(cors, {})
})
