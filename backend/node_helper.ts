import { arch, version, release } from "os";

import { create, IHelperConfig } from "node_helper";
import glucoseFetcher, { IGlucoseFetcher } from "./glucoseFetcher";
import { newDexcomShareConfig } from "./dexcom-share";

const architecture = arch();
const osVersion = release();

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
  start(): void;
  stop(): void;
}

const newGlucoseFetcher = (config: ModuleConfig) => {
  const dsConfig = newDexcomShareConfig(
    config.userName,
    config.password,
    config.server,
    config.applicationId,
    config.entryLength
  );
  return glucoseFetcher(dsConfig);
};

const nodeHelperConfig: IDexcomNodeHelperConfig = {
  start() {
    console.info(
      `Starting Module Helper version : ${ModuleDetails.version} - ${osVersion}:${architecture}`
    );
  },
  stop() {
    console.info("Stopping Module Helper....");
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
    }
    switch (notification) {
      case "START_FETCHING":
        if (this.config) {
          //create the fetcher and start it.
          this.fetcher = newGlucoseFetcher(this.config);
          this.fetcher.onGlucoseReceived = (bsgvals) => {
            if (this.sendSocketNotification) {
              this.sendSocketNotification("BLOODSUGAR_VALUES", {
                received: new Date(),
                entries: bsgvals
              });
            }
          };
          this.fetcher.start();
        }
        break;
      case "STOP_FETCHING":
        if (this.fetcher) {
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
