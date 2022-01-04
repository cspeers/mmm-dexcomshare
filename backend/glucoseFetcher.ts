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
  onGlucoseReceived?(bsgvals: DexcomShareGlucoseEntry[]): void;
}

function fetchLoop(me: IGlucoseFetcher) {
  const { stopRequested, loopInterval } = me;
  if (stopRequested && loopInterval) {
    clearInterval(loopInterval);
  } else {
    if (me.sessionId) {
      console.info(`Current Session Present, retrieving glucose`, me.sessionId);
      try {
        //fetch the glucose
        fetchGlucose(me, me.sessionId).then((bsgvals) => {
          if (bsgvals && me.onGlucoseReceived) {
            me.onGlucoseReceived(bsgvals);
          }
        });
      } catch (error) {
        console.error(`Error fetching glucose, re-authorizing`, error);
        me.sessionId = undefined;
        //refresh the token
        authorizeDexcomShare(me)
          //then fetch the glucose
          .then((sessionId) => {
            if (sessionId) {
              me.sessionId = sessionId;
              fetchGlucose(me, sessionId).then((bsgvals) => {
                if (bsgvals && me.onGlucoseReceived) {
                  me.onGlucoseReceived(bsgvals);
                }
              });
            } else {
              console.error(`Unable to obtain session for ${me.accountName}`);
            }
          });
      }
    } else {
      //refresh the token
      authorizeDexcomShare(me)
        //then fetch the glucose
        .then((sessionId) => {
          if (sessionId) {
            me.sessionId = sessionId;
            fetchGlucose(me, sessionId).then((bsgvals) => {
              if (bsgvals && me.onGlucoseReceived) {
                me.onGlucoseReceived(bsgvals);
              }
            });
          } else {
            console.error(`Unable to obtain session for ${me.accountName}`);
          }
        });
    }
  }
}

const glucoseFetcher = (
  config: DexcomShareConfig,
  fetchInterval: number = 300
): IGlucoseFetcher => {
  const fetcher: IGlucoseFetcher = {
    ...config,
    fetchInterval,
    stopRequested: false,
    entryLength: 1440,
    start() {
      const me = this as IGlucoseFetcher;
      fetchLoop(me);
      me.loopInterval = setInterval(() => fetchLoop(me), fetchInterval * 1000);
    },
    stop() {
      const me = this as IGlucoseFetcher;
      me.stopRequested = true;
    }
  };
  return fetcher;
};

export default glucoseFetcher;
