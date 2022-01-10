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
  Accept: "application/json"
};

/** Trend Readings as Reported */
type DexcomTrend =
  | "None"
  | "DoubleUp"
  | "SingleUp"
  | "FortyFiveUp"
  | "Flat"
  | "FortyFiveDown"
  | "SingleDown"
  | "DoubleDown"
  | "NOT COMPUTABLE"
  | "RATE OUT OF RANGE";

export interface DexcomShareConfig {
  server: string;
  applicationId: string;
  instance(): AxiosInstance;
  accountName?: string;
  password?: string;
  entryLength: number;
  maxCount: number;
}

export interface NightScoutGlucoseEntry {
  sgv: number;
  date: number;
  dateString: string;
  trend: DexcomTrend;
  direction: string;
  device: "share2";
  type: "sgv";
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

export type DexcomResponse = DexcomShareGlucose<string>[];

function trendToUnicode(trend: DexcomTrend): string {
  switch (trend) {
    case "DoubleUp":
      return "⇈";
    case "SingleUp":
      return "↑";
    case "FortyFiveUp":
      return "↗";
    case "Flat":
      return "→";
    case "FortyFiveDown":
      return "↘";
    case "SingleDown":
      return "↓";
    case "DoubleDown":
      return "⇊";
    case "RATE OUT OF RANGE":
      return "⇕";
    case "None":
      return "⇼";
    case "NOT COMPUTABLE":
    default:
      return "-";
  }
}

function mapDexcomEntry(
  e: DexcomShareGlucose<string>
): DexcomShareGlucoseEntry {
  const { Trend, Value, DT, WT, ST } = e;
  const DirectionAsUnicode = trendToUnicode(Trend);
  return {
    DT: moment(DT).local().toDate(),
    ST: moment(ST).toDate(),
    WT: moment(WT).toDate(),
    Trend,
    Value,
    Direction: Trend,
    DirectionAsUnicode
  };
}

function mapNightscoutEntry(
  e: DexcomShareGlucose<string>
): NightScoutGlucoseEntry {
  const { Value, Trend, WT } = e;
  const d = moment(WT);
  const date = d.unix();
  const dateString = moment(WT).toDate().toString();
  return {
    date,
    dateString,
    device: "share2",
    type: "sgv",
    trend: Trend,
    direction: Trend,
    sgv: Value
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
        headers: DEFAULT_HEADERS
      });
    }
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
    console.error(error);
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
    console.error(error);
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
  const response = await instance.post<DexcomResponse>(glucosePath);
  const { data, status, statusText } = response;
  if (data.length > 0) {
    console.debug(
      `[${status} ${statusText}] Received ${data.length} Glucose entries from ${response.config.baseURL}`
    );
    const glucose = data.map(mapper);
    return glucose;
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
