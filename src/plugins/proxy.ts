import fp from "fastify-plugin"
// @ts-ignore
import proxy from "@fastify/http-proxy"
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
            agentOptions: Type.Object({
              keepAliveMsecs: Type.Number(), //  10 * 60 * 1000
            }),
            requestOptions: Type.Object({
              timeout: Type.Number(), // timeout in msecs, defaults to 10000 (10 seconds)
            }),
          })
        ),
        /** Can be true to enable http2 protocol, or a list of settings for http2 connections */
        http2: Type.Optional(
          Type.Union([
            Type.Boolean(),
            Type.Object({
              sessionTimeout: Type.Optional(Type.Number()), // HTTP/2 session timeout in msecs, defaults to 60000 (1 minute)
              requestTimeout: Type.Optional(Type.Number()), // HTTP/2 session timeout in msecs, defaults to 60000 (1 minute)
              sessionOptions: Type.Optional(
                Type.Object({
                  rejectUnauthorized: Type.Boolean(),
                })
              ),
              requestOptions: Type.Optional(
                Type.Object({
                  endStream: Type.Boolean(),
                })
              ),
            }),
          ])
        ),
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
      backend: {
        host: "http://localhost:3030",
        endpoint: "/cars",
      },
    },
    {
      description: "V1 of the Cars API find and get",
      endpoint: "/api/v1/cars",
      methods: ["HEAD"],
      backend: {
        host: "http://localhost:3030",
        endpoint: "/cars",
      },
    },
    {
      description: "V1 of the Cars API updates",
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
    // {
    //   description: "V1 of the Cars API updates",
    //   endpoint: "/api/v1/cars",
    //   methods: ["PUT"],
    //   backend: {
    //     host: "http://localhost:3030",
    //     endpoint: "/trucks",
    //   },
    // },
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
export default fp<any>(async fastify => {
  for (let value of apilist.endpoints) {
    // Skip disabled routes
    if (value.disabled === true) {
      continue
    }

    // @ts-ignore
    const proxyConfig = {
      upstream: value.backend.host,
      prefix: value.endpoint,
      rewritePrefix: value.backend.endpoint,
      http2: value.backend.http2,
      replyOptions: {
        rewriteRequestHeaders: (originalReq: any, headers: any) => {
          const newHeaders = { ...headers, "request-id": uuid() }
          console.log(newHeaders)
          return newHeaders
        },
      },
      preHandler: (request: any, reply: any, done: any) => {
        done()
      },
      httpMethods: value.methods,
    }
    fastify.register(proxy, proxyConfig)
  }
})
