import moment from "moment";

import {
  authorizeDexcomShare,
  DexcomShareConfig,
  DexcomShareGlucoseEntry,
  fetchGlucose
} from "./dexcom-share";

/**
 * Simple worker to authorize and fetch values from the dexcom share API
 * on a repeated cadence
 */
export interface IGlucoseFetcher extends DexcomShareConfig {
  fetchInterval: number;
  sessionId?: string;
  stopRequested: boolean;
  entryLength: number;
  start(): void;
  stop(): void;
  loopInterval?: NodeJS.Timer;
  log: ILogger;
  onGlucoseReceived?(bsgvals: DexcomShareGlucoseEntry[]): void;
}

function authorizeAndFetch(me: IGlucoseFetcher) {
  //refresh the token
  const { log } = me;
  authorizeDexcomShare(me)
    //then fetch the glucose
    .then((sessionId) => {
      if (sessionId) {
        log.info(`Obtained new sessionId: ${sessionId}`);
        me.sessionId = sessionId;
        fetchGlucose(me, sessionId).then((bsgvals) => {
          if (bsgvals && me.onGlucoseReceived) {
            me.onGlucoseReceived(bsgvals);
          }
        });
      } else {
        log.error(`Unable to obtain session for ${me.accountName}`);
      }
    });
}

function fetchLoop(me: IGlucoseFetcher) {
  const { stopRequested, loopInterval, log } = me;
  if (stopRequested && loopInterval) {
    clearInterval(loopInterval);
  } else {
    if (me.sessionId) {
      log.info(`Current Session Present, retrieving glucose ${me.sessionId}`);
      try {
        //fetch the glucose
        fetchGlucose(me, me.sessionId).then((bsgvals) => {
          if (bsgvals && me.onGlucoseReceived) {
            me.onGlucoseReceived(bsgvals);
          }
        });
      } catch (error) {
        me.sessionId = undefined;
        log.error(`Error fetching glucose, re-authorizing ${error}`);
        authorizeAndFetch(me);
      }
    } else {
      authorizeAndFetch(me);
    }
  }
}

const glucoseFetcher = (
  config: DexcomShareConfig,
  fetchInterval: number = 300,
  log: ILogger
): IGlucoseFetcher => {
  const fetchIntervalMs = fetchInterval * 1000;
  return {
    ...config,
    fetchInterval,
    stopRequested: false,
    log,
    start() {
      const fetcher = () => {
        log.info(`Starting fetch at ${moment(moment.now()).format()}`);
        fetchLoop(this);
        log.info(
          `Next execution at ${moment(moment.now() + fetchIntervalMs).format()}`
        );
      };
      try {
        fetcher();
        this.loopInterval = setInterval(fetcher, fetchIntervalMs);
      } catch (error) {
        this.log.error(`Error setting up fetch loop! ${error}`);
      }
    },
    stop() {
      this.stopRequested = true;
    }
  };
};

export default glucoseFetcher;
