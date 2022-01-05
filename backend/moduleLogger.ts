export const moduleLogger: ILogger = {
  error(e) {
    console.error(`[${ModuleDetails.name}] ${e}`);
  },
  info(e) {
    console.info(`[${ModuleDetails.name}] ${e}`);
  },
  warn(e) {
    console.warn(`[${ModuleDetails.name}] ${e}`);
  }
};
