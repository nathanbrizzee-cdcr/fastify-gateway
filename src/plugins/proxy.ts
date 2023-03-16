import fp from "fastify-plugin"
// @ts-ignore
import proxy from "@fastify/http-proxy"
import * as hyperid from "hyperid"
import { Type, Static } from "@sinclair/typebox"
import Ajv from "ajv"

const ajv = new Ajv()
const uuid = hyperid()
const apiConfigType = Type.Object({
  version: Type.String(),
  endpoints: Type.Array(
    Type.Object({
      /** A description of this api endpoint */
      description: Type.Optional(Type.String()),
      /**example "/v1/foo-bar" */
      endpoint: Type.RegEx(/^\/([a-z0-9_\-\/]+[^\/])$/),
      /** If true, this API end point will not be registered.  Defaults to false */
      disabled: Type.Optional(Type.Boolean()),
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

      backend: Type.Object({
        host: Type.RegEx(
          /((http|https):\/\/)([a-z0-9]+\.)?([a-z0-9][a-z0-9-]*)?((\.[a-z]{2,6})|(\.[a-z]{2,6})(\.[a-z]{2,6}))?(:\d{1,5})$/
        ),
        endpoint: Type.RegEx(/^\/([a-z0-9_\-\/]+[^\/])$/),
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

// export default fp<any>(async fastify => {
//   console.log("I'm here in proxy")
//   const proxyConfig = {
//     upstream: "http://localhost:3030",
//     prefix: "/api/v1/cars", // optional
//     rewritePrefix: "/cars", // options
//     http2: false, // optional
//     replyOptions: {
//       rewriteRequestHeaders: (originalReq: any, headers: any) => {
//         // console.log(originalReq)
//         const newHeaders = { ...headers, "request-id": uuid() }
//         console.log(newHeaders)
//         return newHeaders
//       },
//     },
//     preHandler: (request: any, reply: any, done: any) => {
//       //console.log({ request, reply })
//       done()
//     },
//     // httpMethods: ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS"], // optional
//     httpMethods: ["GET", "HEAD", "OPTIONS"], // optional
//     //httpMethods: ["GET", "HEAD"], // optional
//   }
//   fastify.register(proxy, proxyConfig)

//   const proxyConfig2 = {
//     upstream: "http://localhost:3030",
//     prefix: "/api/v1/cars", // optional
//     rewritePrefix: "/trucks", // options
//     http2: false, // optional
//     replyOptions: {
//       rewriteRequestHeaders: (originalReq: any, headers: any) => ({
//         ...headers,
//         "request-id": uuid(),
//       }),
//     },
//     // httpMethods: ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS"], // optional
//     httpMethods: ["PATCH", "POST", "PUT"], // optional
//   }
//   fastify.register(proxy, proxyConfig2)

//   const proxyConfig3 = {
//     upstream: "http://localhost:3030",
//     prefix: "/api/v1/cars", // optional
//     rewritePrefix: "/cars", // options
//     http2: false, // optional
//     replyOptions: {
//       rewriteRequestHeaders: (originalReq: any, headers: any) => ({
//         ...headers,
//         "request-id": uuid(),
//       }),
//     },
//     // httpMethods: ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS"], // optional
//     httpMethods: ["DELETE"], // optional
//   }
//   fastify.register(proxy, proxyConfig3)
// })
