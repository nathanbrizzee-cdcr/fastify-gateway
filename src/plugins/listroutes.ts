import fp from "fastify-plugin"

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
      // let c1 = a.url.localeCompare(b.url)
      // if (!c1) {
      //   const aMethod: string =
      //     typeof a.method === "object" ? a.method.join(", ") : a.method
      //   const bMethod: string =
      //     typeof b.method === "object" ? b.method.join(", ") : b.method
      //   console.log(aMethod, bMethod)
      //   return aMethod.localeCompare(bMethod)
      // }
      // return c1
      return a.url.localeCompare(b.url)
    })

    fastify.log.info("Available routes:")
    for (const routeOption of routeOptions) {
      const { method, url } = routeOption
      // if (method === "HEAD") continue
      fastify.log.info({
        url,
        methods: typeof method === "string" ? [method] : method,
      })
    }
    done()
  })
})
