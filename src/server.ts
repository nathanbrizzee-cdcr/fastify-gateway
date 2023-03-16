'use strict'

// Read the .env file.
import * as dotenv from 'dotenv'
dotenv.config();

// Require the framework
import { fastify as Fastify, FastifyListenOptions } from 'fastify';

// Add the logger
import pino from 'pino';

// Instantiate Fastify with some config
const app = Fastify({
  logger: pino({level: process.env.FASTIFY_LOG_LEVEL || 'info'})
})

// Register your application as a normal plugin.
const appService = require('./app.js')
app.register(appService)

app.addHook('onClose', (instance, done) => {
  done()
})

// for Node < v15, handle the unhandled rejection
process.on('unhandledRejection', function (err) {
  app.log.error(err)
  process.exit(1)
})

//if (process.env.NODE_ENV === 'production') {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () =>
    app.close().then((err) => {
        app.log.error(err)
        app.log.error(`close application on ${signal}`)
        process.exit(err ? 1 : 0)
      }),
    )
  }
//}

const FastifyOptions: FastifyListenOptions={
  port: process.env.FASTIFY_PORT? parseInt(process.env.FASTIFY_PORT) : 3000,
  host: process.env.FASTIFY_ADDRESS || 'localhost'
}
const start = async () => {
  try {
      // Start listening.
      await app.listen(FastifyOptions);
      app.log.info('Server started successfully');
  } catch (err) {
      app.log.error(err)
      process.exit(1);
  }
};
start();
