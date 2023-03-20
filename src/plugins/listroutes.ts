import fp from "fastify-plugin"

// module.exports = fp(fastifyListRoute, {
//   name: "fastify-list-routes",
//   fastify: "4.x",
// });

/**
 * This plugins prints out all the registered routes
 *
 * @see https://github.com/chuongtrh/fastify-list-routes
 */
export default fp<any>(async fastify => {
  const routeOptions: Array<any> = []

  fastify.addHook("onRoute", routeOption => {
    routeOptions.push(routeOption)
  })

  fastify.addHook("onReady", done => {
    routeOptions.sort((a, b) => {
      return a.url.localeCompare(b.url)
    })

    fastify.log.info("Available routes:")
    for (const routeOption of routeOptions) {
      const { method, url } = routeOption
      // if (method === "HEAD") continue
      fastify.log.info(
        `${typeof method === "string" ? [method] : method} => ${url}`
      )
    }
    done()
  })
})
