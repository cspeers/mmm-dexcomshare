import { arch, version } from "os";

import { create, IHelperConfig } from "node_helper";

const architecture = arch();
const osVersion = version();

/** module helper configuration interface */
interface IDexcomNodeHelperConfig extends IHelperConfig {
  config?: {
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
}

function socketNotificationReceived(notification: string) {}
