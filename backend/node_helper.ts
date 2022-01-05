import { arch, release } from "os";

import { IHelperConfig, create } from "node_helper";

import glucoseFetcher, { IGlucoseFetcher } from "./glucoseFetcher";
import { DexcomShareGlucoseEntry, newDexcomShareConfig } from "./dexcom-share";
import { moduleLogger } from "./moduleLogger";

/** Base configuration options */
type ModuleConfig = {
  /** Dexcom Share Account */
  userName: string;
  /** Dexcom Share Account Password */
  password: string;
  /** Dexcom Share API host */
  server: string;
  /** The length of time in minutes to fetch glucose readings */
  entryLength: number;
  /** The interval to fetch the readings */
  refreshInterval: number;
  /** The share2 application id */
  applicationId: string;
};

/** module helper configuration interface */
interface IDexcomNodeHelperConfig extends IHelperConfig {
  fetcher?: IGlucoseFetcher;
  config?: ModuleConfig;
  socketNotificationReceived(
    notification: DexcomModuleNotificationType,
    payload?: ModuleConfig
  ): void;
  sendSocketNotification?(
    notification: DexcomModuleNotificationType,
    payload: IDexcomGlucoseEntryMessage<DexcomShareGlucoseEntry>
  ): void;
  start(): void;
  stop(): void;
}

const nodeHelperConfig: IDexcomNodeHelperConfig = {
  start() {
    moduleLogger.info(
      `Starting Module Helper version : ${
        ModuleDetails.version
      } - ${release()}:${arch()}`
    );
  },
  stop() {
    moduleLogger.info("Stopping Module Helper....");
    if (this.fetcher) {
      this.fetcher.stop();
    }
  },
  socketNotificationReceived(
    notification: DexcomModuleNotificationType,
    payload?: ModuleConfig
  ) {
    if (payload) {
      //this should be the config..
      this.config = payload;
      moduleLogger.info(
        `Received Module config Interval ${this.config.refreshInterval} secs...`
      );
    }
    switch (notification) {
      case "START_FETCHING":
        if (this.config) {
          //create the fetcher and start it.
          const {
            refreshInterval,
            userName,
            password,
            server,
            applicationId,
            entryLength
          } = this.config;
          this.fetcher = glucoseFetcher(
            newDexcomShareConfig(
              userName,
              password,
              server,
              applicationId,
              entryLength
            ),
            refreshInterval,
            moduleLogger
          );
          this.fetcher.onGlucoseReceived = (entries) => {
            if (this.sendSocketNotification) {
              const received = new Date();
              moduleLogger.info(
                `Received ${entries.length} entries at ${received}`
              );
              this.sendSocketNotification("BLOODSUGAR_VALUES", {
                received,
                entries
              });
            }
          };
          moduleLogger.info(`Starting fetch cycle...`);
          this.fetcher.start();
        }
        break;
      case "STOP_FETCHING":
        if (this.fetcher) {
          moduleLogger.info(`Halting fetch cycle...`);
          this.fetcher.stop();
        }
        break;
      default:
        //someone else's
        break;
    }
  }
};

module.exports = create(nodeHelperConfig);
