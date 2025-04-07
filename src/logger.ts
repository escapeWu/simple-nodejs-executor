import * as log4js from "log4js";

log4js.configure({
    appenders: {
      everything: { type: "file", filename: "RUN.log" },
      emergencies: { type: "file", filename: "ERROR.log" },
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
  logger.info("Logger 启动");

  export default log4js.getLogger();