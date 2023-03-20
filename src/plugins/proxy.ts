import fp from "fastify-plugin"
import proxy from "@fastify/http-proxy"
import fastifyCircuitBreaker from "@fastify/circuit-breaker"

import * as hyperid from "hyperid"
import { Type, Static } from "@sinclair/typebox"
import Ajv from "ajv"

const ajv = new Ajv()
const uuid = hyperid()
const apiConfigType = Type.Object({
  /**Version of this spec.  ex. 1.0 */
  version: Type.String(),
  /** List of all the endpoints for the gateway */
  endpoints: Type.Array(
    Type.Object({
      /** A description of this api endpoint */
      description: Type.Optional(Type.String()),
      /**example "/v1/foo-bar" */
      endpoint: Type.RegEx(/^\/([a-z0-9_\-\/]+[^\/])$/),
      /** If true, this API end point will not be registered.  Defaults to false */
      disabled: Type.Optional(Type.Boolean()),
      /** List of methods this route applies to */
      methods: Type.Array(
        Type.Union([
          Type.Literal("GET"),
          Type.Literal("POST"),
          Type.Literal("PATCH"),
          Type.Literal("PUT"),
          Type.Literal("DELETE"),
          Type.Literal("OPTIONS"),
          Type.Literal("HEAD"),
        ])
      ),
      /**
       * Optional configuration for a circuit breaker.
       */
      circuitBreaker: Type.Optional(
        Type.Object({
          /** Whether the circuit breaker is enabled or not for this route */
          enabled: Type.Boolean(),
          /** The maximum number of failures accepted before opening the circuit.
           * @default 5
           */
          threshold: Type.Optional(Type.Number()),
          /** The maximum number of milliseconds to wait before returning a TimeoutError
           * @summary
           *  Since it is not possible to apply the classic timeout feature of the pattern,
           *  in this case the timeout will measure the time that the route takes to execute and
           *  once the route has finished if the time taken is higher than the timeout it will
           *  return an error, even if the route has produced a successful response.
           * @default 10000
           */
          timeout: Type.Optional(Type.Number()),
          /** The number of milliseconds before the circuit will move from open to half-open
           * @default 10000
           */
          resetTimeout: Type.Optional(Type.Number()),
        })
      ),
      /** Information about the backend that the API will be proxied to */
      backend: Type.Object({
        /** Server name that the reqest will be sent to. */
        host: Type.RegEx(
          /((http|https):\/\/)([a-z0-9]+\.)?([a-z0-9][a-z0-9-]*)?((\.[a-z]{2,6})|(\.[a-z]{2,6})(\.[a-z]{2,6}))?(:\d{1,5})$/
        ),
        /**API end point on the backend server to route to */
        endpoint: Type.RegEx(/^\/([a-z0-9_\-\/]+[^\/])$/),
        /**List of options for the http connection to the backend server */
        http: Type.Optional(
          Type.Object({
            // agentOptions: Type.Optional(
            //   Type.Object({
            //     keepAliveMsecs: Type.Optional(Type.Number()), //  10 * 60 * 1000
            //   })
            // ),
            requestOptions: Type.Optional(
              Type.Object({
                timeout: Type.Optional(Type.Number()), // timeout in msecs, defaults to 10000 (10 seconds)
              })
            ),
          })
        ),
        // /** Can be true to enable http2 protocol, or a list of settings for http2 connections */
        // http2: Type.Optional(
        //   Type.Union([
        //     Type.Boolean(),
        //     Type.Object({
        //       /**HTTP/2 session timeout in msecs, defaults to 60000 (1 minute) */
        //       sessionTimeout: Type.Optional(Type.Number()),
        //       /** HTTP/2 request timeout in msecs, defaults to 10000 (10 seconds) */
        //       requestTimeout: Type.Optional(Type.Number()),
        //       /** HTTP/2 session connect options, pass in any options from https://nodejs.org/api/http2.html#http2_http2_connect_authority_options_listener */
        //       sessionOptions: Type.Optional(
        //         Type.Object({
        //           rejectUnauthorized: Type.Boolean(),
        //         })
        //       ),
        //       /** HTTP/2 request options, pass in any options from https://nodejs.org/api/http2.html#clienthttp2sessionrequestheaders-options */
        //       requestOptions: Type.Optional(
        //         Type.Object({
        //           endStream: Type.Boolean(),
        //         })
        //       ),
        //     }),
        //   ])
        // ),
      }),
    })
  ),
})
export type apiConfigSchema = Static<typeof apiConfigType>
const apilist: apiConfigSchema = {
  version: "1.0",
  endpoints: [
    {
      description: "V1 of the Cars API find and get",
      endpoint: "/api/v1/cars",
      methods: ["GET"],
      circuitBreaker: {
        enabled: true,
        threshold: 2,
        timeout: 4000,
        resetTimeout: 30000,
      },
      backend: {
        host: "http://localhost:3030",
        endpoint: "/cars",
        http: {
          requestOptions: {
            timeout: 4000,
          },
        },
      },
    },
    {
      description: "V1 of the Cars API head",
      endpoint: "/api/v1/cars",
      methods: ["HEAD"],
      backend: {
        host: "http://localhost:3030",
        endpoint: "/cars",
      },
    },
    {
      description: "V1 of the Cars API create",
      endpoint: "/api/v1/cars",
      methods: ["POST"],
      backend: {
        host: "http://localhost:3030",
        endpoint: "/trucks",
      },
    },
    {
      description: "V1 of the Cars API updates",
      endpoint: "/api/v1/cars",
      methods: ["PATCH", "PUT"],
      backend: {
        host: "http://localhost:3030",
        endpoint: "/trucks",
      },
    },
    {
      description: "V1 of the Cars API deletes",
      endpoint: "/api/v1/cars",
      methods: ["DELETE"],
      backend: {
        host: "http://localhost:3030",
        endpoint: "/cars",
      },
    },
  ],
}

// console.log(JSON.stringify(apilist, null, 2))
const valid = ajv.validate(apiConfigType, apilist)
if (!valid) {
  console.log(ajv.errors)
  throw new Error(JSON.stringify(ajv.errors, null, 2))
}

/**
 * This plugins proxies rquests
 *
 * @see https://github.com/fastify/fastify-cors
 */
export default fp(async (fastify, opts: any) => {
  /** Register the circuit breaker library */
  await fastify.register(fastifyCircuitBreaker, {
    onCircuitOpen: async (req, reply) => {
      reply.statusCode = 500
      throw new Error(
        "Service temporarily unavailable (circuit breaker tripped)"
      )
    },
    onTimeout: async (req, reply) => {
      reply.statusCode = 504
      throw new Error("Service timed out (circuit breaker timeout)")
    },
  })

  /** The onResponse hook is executed when a response has been sent, so you will not be able to send more data to the client */
  fastify.addHook("onResponse", async (request, reply) => {
    const milliseconds = reply.getResponseTime()
    fastify.log.info({
      onResponse: milliseconds,
      msg: "after reply sent to client",
    })
  })

  /**
   * onSend is fired just before the response is sent to the front end.
   * The onResponse hook is executed when a response has been sent, so you will not be able to send more data to the client
   */
  fastify.addHook("onSend", async (request, reply) => {
    const milliseconds = reply.getResponseTime()
    fastify.log.info({
      onSend: milliseconds,
      msg: "before reply sent to client",
    })
    reply.header("X-Response-Time", String(milliseconds))
  })

  /** Loop through the endpoints and add them to the route list */
  for (let route of apilist.endpoints) {
    // Skip disabled routes
    if (route.disabled === true) {
      continue
    }
    const circuitBreakerConfig = {
      threshold: route.circuitBreaker?.threshold, // default 5
      timeout: route.circuitBreaker?.timeout, // default 10000
      resetTimeout: route.circuitBreaker?.resetTimeout, // default 10000
    }

    /** Configure a default timeout for http calls - that can be overridden */
    const httpRequestTimeout = {
      requestOptions: {
        timeout: 10000,
      },
    }
    // @ts-ignore
    const proxyConfig = {
      upstream: route.backend.host,
      prefix: route.endpoint,
      rewritePrefix: route.backend.endpoint,
      http2: false,
      http: route.backend.http
        ? Object.assign(httpRequestTimeout, route.backend.http)
        : httpRequestTimeout,
      //http2: route.backend.http2,
      replyOptions: {
        rewriteRequestHeaders: (originalReq: any, headers: any) => {
          // Add a custom header for tracking the request across servers
          const newHeaders = { ...headers, "request-id": uuid() }
          // console.log(newHeaders)
          return newHeaders
        },
      },
      // preHandler: (request: any, reply: any, done: any) => {
      //   done()
      // },
      preHandler: route.circuitBreaker?.enabled
        ? fastify.circuitBreaker(circuitBreakerConfig)
        : undefined,
      //preHandler: fastify.circuitBreaker(circuitBreakerConfig),
      httpMethods: route.methods,
    }
    await fastify.register(proxy, proxyConfig)
  }
})
