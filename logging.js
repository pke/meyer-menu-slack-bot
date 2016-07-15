const winston = require("winston")
const Papertrail = require("winston-papertrail").Papertrail

const logger = new winston.Logger({
  exitOnError: false,
  transports: [
    new winston.transports.Console({
      level: "debug",
      timestamp() {
        return new Date().toISOString()
      },
      colorize: true,
      handleExceptions: true,
    }),
    new Papertrail({
      host: "logs4.papertrailapp.com",
      port: 10919,
      colorize: true,
      handleExceptions: true,
      program: "Meyer Menu Slack Bot",
    }),
  ]
})

console.info = logger.info.bind(this)
console.debug = logger.debug.bind(this)
console.warn = logger.warn.bind(this)
console.error = logger.error.bind(this)

module.exports = logger 