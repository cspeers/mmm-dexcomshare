import {
  authorizeDexcomShare,
  DexcomShareConfig,
  DexcomShareGlucoseEntry,
  fetchGlucose
} from "./dexcom-share";

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

function authorizeAndFetch(me: IGlucoseFetcher, log: ILogger) {
  //refresh the token
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
        authorizeAndFetch(me, log);
      }
    } else {
      authorizeAndFetch(me, log);
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
    entryLength: 1440,
    log,
    start() {
      try {
        fetchLoop(this);
        this.loopInterval = setInterval(() => fetchLoop(this), fetchIntervalMs);
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
