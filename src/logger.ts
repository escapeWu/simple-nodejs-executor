import * as log4js from "log4js";

log4js.configure({
    appenders: {
      everything: { type: "file", filename: "all-the-logs.log" },
      emergencies: { type: "file", filename: "oh-no-not-again.log" },
      "just-errors": {
        type: "logLevelFilter",
        appender: "emergencies",
        level: "error",
      },
    },
    categories: {
      default: { appenders: ["just-errors", "everything"], level: "debug" },
    },
  });
  
  const logger = log4js.getLogger();
  logger.debug("This goes to all-the-logs.log");
  logger.info("As does this.");
  logger.error("This goes to all-the-logs.log and oh-no-not-again.log");

  export default log4js.getLogger();