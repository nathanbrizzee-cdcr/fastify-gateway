import fp from "fastify-plugin"
import cors from "@fastify/cors"

/**
 * This plugins adds cors protection
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp<any>(async fastify => {
  console.log("I'm here in cors")
  fastify.register(cors, {})
})
