import axios, { AxiosInstance } from "axios";
import moment from "moment";

export const US_SERVER = "share2.dexcom.com";
export const EU_SERVER = "shareous1.dexcom.com";
export const DEFAULT_APPLICATION_ID = "d89443d2-327c-4a6f-89e5-496bbb0317db";

const AUTH_URL =
  "/ShareWebServices/Services/General/AuthenticatePublisherAccount";
const LOGIN_URL =
  "/ShareWebServices/Services/General/LoginPublisherAccountById";
const LATEST_GLUCOSE_URL =
  "/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues";

const DEFAULT_HEADERS = {
  "User-Agent": "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0",
  "Content-Type": "application/json",
  Accept: "application/json",
};

interface DexcomShareConfig {
  server: string;
  applicationId: string;
  instance(): AxiosInstance;
  accountName?: string;
  password?: string;
  entryLength: number;
  maxCount: number;
}

interface NightScoutGlucoseEntry {
  sgv: number;
  date: number;
  dateString: string;
  trend: number;
  direction: string;
  device: "share2";
  type: "sgv";
}

/** Trend Readings as Reported */
enum DexcomTrend {
  None = 0,
  DoubleUp = 1,
  SingleUp = 2,
  FortyFiveUp = 3,
  Flat = 4,
  FortyFiveDown = 5,
  SingleDown = 6,
  DoubleDown = 7,
  NotComputable = 8,
  OutOfRange = 9,
}

interface DexcomShareGlucose<T> {
  /** The time */
  DT: T;
  /** The time */
  ST: T;
  /** The blood sugar trend */
  Trend: DexcomTrend;
  /** The blood sugar value */
  Value: number;
  /** The wall time for the reading */
  WT: T;
}

/** Reading from Dexcom Share2 */
export interface DexcomShareGlucoseEntry extends DexcomShareGlucose<Date> {
  /** The trend as a direction */
  Direction: string;
  /** The trend as a unicode character */
  DirectionAsUnicode: string;
}

type DexcomResponse = Array<DexcomShareGlucose<string>>;

function trendToDirection(trend: DexcomTrend): string {
  switch (trend) {
    case DexcomTrend.DoubleDown:
      return "DoubleDown";
    case DexcomTrend.DoubleUp:
      return "DoubleUp";
    case DexcomTrend.Flat:
      return "Flat";
    case DexcomTrend.FortyFiveDown:
      return "FortyFiveDown";
    case DexcomTrend.FortyFiveUp:
      return "FortyFiveUp";
    case DexcomTrend.NotComputable:
      return "NotComputable";
    case DexcomTrend.OutOfRange:
      return "OutOfRange";
    case DexcomTrend.SingleDown:
      return "SingleDown";
    case DexcomTrend.SingleUp:
      return "SingleUp";
    case DexcomTrend.None:
    default:
      return "None";
  }
}

function trendToUnicode(trend: DexcomTrend): string {
  switch (trend) {
    case DexcomTrend.DoubleUp:
      return "⇈";
    case DexcomTrend.SingleUp:
      return "↑";
    case DexcomTrend.FortyFiveUp:
      return "↗";
    case DexcomTrend.Flat:
      return "→";
    case DexcomTrend.FortyFiveDown:
      return "↘";
    case DexcomTrend.SingleDown:
      return "↓";
    case DexcomTrend.DoubleDown:
      return "⇊";
    case DexcomTrend.OutOfRange:
      return "⇕";
    case DexcomTrend.None:
      return "⇼";
    default:
      return "-";
  }
}

function mapDexcomEntry(
  e: DexcomShareGlucose<string>
): DexcomShareGlucoseEntry {
  const { Trend, Value, DT, WT, ST } = e;
  const Direction = trendToDirection(Trend);
  const DirectionAsUnicode = trendToUnicode(Trend);
  return {
    DT: moment(DT).local().toDate(),
    ST: moment(ST).toDate(),
    WT: moment(WT).toDate(),
    Trend,
    Value,
    Direction,
    DirectionAsUnicode,
  };
}

function mapNightscoutEntry(
  e: DexcomShareGlucose<string>
): NightScoutGlucoseEntry {
  const { Value, Trend, WT } = e;
  const direction = trendToDirection(Trend);
  const d = moment(WT);
  const date = d.unix();
  const dateString = moment(WT).toDate().toString();
  return {
    date,
    dateString,
    device: "share2",
    type: "sgv",
    trend: Trend,
    direction,
    sgv: Value,
  };
}

export const newDexcomShareConfig = (
  accountName: string,
  password: string,
  server: string = US_SERVER,
  applicationId: string = DEFAULT_APPLICATION_ID,
  entryLength: number = 1440
): DexcomShareConfig => {
  const maxCount = Math.floor(entryLength / 5);
  return {
    accountName,
    password,
    server,
    applicationId,
    entryLength,
    maxCount,
    instance() {
      return axios.create({
        baseURL: `https://${this.server}`,
        headers: DEFAULT_HEADERS,
      });
    },
  };
};

export async function getDexcomShareAccountId(
  config: DexcomShareConfig
): Promise<string | undefined> {
  const { applicationId, accountName, password } = config;
  const instance = config.instance();
  const body = { password, applicationId, accountName };
  try {
    const { data } = await instance.post<string>(AUTH_URL, body);
    return data;
  } catch (error) {
    console.log(error);
  }
}

export async function getDexcomShareSessionId(
  accountId: string,
  config: DexcomShareConfig
) {
  const { applicationId, password } = config;
  const instance = config.instance();
  const body = { password, applicationId, accountId };
  try {
    const { data } = await instance.post<string>(LOGIN_URL, body);
    return data;
  } catch (error) {
    console.log(error);
  }
}

export async function authorizeDexcomShare(config: DexcomShareConfig) {
  const { accountName, password } = config;
  if (!accountName || !password) {
    throw "Missing Username or Password!";
  }
  const accountId = await getDexcomShareAccountId(config);
  if (accountId) {
    return await getDexcomShareSessionId(accountId, config);
  }
}

export async function getDexcomShareGlucose<T>(
  config: DexcomShareConfig,
  sessionId: string,
  mapper: (entry: DexcomShareGlucose<string>) => T
) {
  const { entryLength, maxCount } = config;
  const glucoseQuery = `sessionID=${sessionId}&minutes=${entryLength}&maxCount=${maxCount}`;
  const glucosePath = `${LATEST_GLUCOSE_URL}?${glucoseQuery}`;
  console.debug(`Retrieving Glucose readings from ${glucosePath}`);
  const instance = config.instance();
  try {
    const { data } = await instance.post<DexcomResponse>(glucosePath);
    if (data.length > 0) {
      return data.map(mapper);
    }
  } catch (error) {
    console.error(error);
  }
}

export async function fetchGlucose(
  config: DexcomShareConfig,
  sessionId: string
) {
  return await getDexcomShareGlucose<DexcomShareGlucoseEntry>(
    config,
    sessionId,
    mapDexcomEntry
  );
}

export async function fetchGlucoseNS(
  config: DexcomShareConfig,
  sessionId: string
) {
  return await getDexcomShareGlucose<NightScoutGlucoseEntry>(
    config,
    sessionId,
    mapNightscoutEntry
  );
}
