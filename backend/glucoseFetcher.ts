import { config } from "process";
import {
  authorizeDexcomShare,
  DexcomShareGlucoseEntry,
  DexcomShareConfig,
  getDexcomShareGlucose,
} from "./dexcom-share";

export interface IGlucoseFetcher extends DexcomShareConfig {
  fetchInterval: number;
  sessionId?: string;
  stopRequested: boolean;
  entryLength: number;
  start(): void;
  stop(): void;
  fetchGlucoseLoop: () => void;
  loopInterval?: NodeJS.Timer;
}

const glucoseFetcher = (config: DexcomShareConfig): IGlucoseFetcher => {
  return {
    ...config,
    fetchInterval: 300,
    stopRequested: false,
    entryLength: 1440,
    start() {
      const me = this as IGlucoseFetcher;
      const { fetchGlucoseLoop, fetchInterval } = me;
      me.loopInterval = setInterval(fetchGlucoseLoop, fetchInterval * 1000);
    },
    stop() {
      const me = this as IGlucoseFetcher;
      me.stopRequested = true;
    },
    fetchGlucoseLoop() {
      const me = this as IGlucoseFetcher;
      if (me.stopRequested && me.loopInterval) {
        clearInterval(me.loopInterval);
      } else {
        if (me.sessionId) {
          try {
            //fetch the glucose
            getDexcomShareGlucose(
              me,
              me.sessionId,
              (bsgValue) => bsgValue
            ).then((bsgvals) => {});
          } catch (error) {
            me.sessionId = undefined;
            //refresh the token
            authorizeDexcomShare(me)
              //then fetch the glucose
              .then((sessionId) => {
                if (sessionId) {
                  me.sessionId = sessionId;
                  getDexcomShareGlucose(
                    me,
                    sessionId,
                    (bsgValue) => bsgValue
                  ).then((bsgvals) => {});
                } else {
                  console.error(
                    `Unable to obtain session for ${me.accountName}`
                  );
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
                getDexcomShareGlucose(
                  me,
                  sessionId,
                  (bsgValue) => bsgValue
                ).then((bsgvals) => {});
              } else {
                console.error(`Unable to obtain session for ${me.accountName}`);
              }
            });
        }
      }
    },
  };
};

export default glucoseFetcher;
