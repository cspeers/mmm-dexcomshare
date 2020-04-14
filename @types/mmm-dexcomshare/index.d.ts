/** Configuration for the module */
declare interface IDexcomModuleConfig  {
    /** Dexcom Share Account */
    userName:string
    /** Dexcom Share Account Password */
    password:string
    /** Dexcom Share API host */
    server:string
    /** The length of time in minutes to fetch glucose readings */
    entryLength:number
    /** The interval to fetch the readings */
    refreshInterval:number
    /** The share2 application id */
    applicationId:string
    /** chartjs chart options */
    chartOptions: Chart.ChartOptions
    /** chartjs chart type */
    chartType:string
    /** the low reading threshold */
    lowRange:number
    /** the high reading threshold */
    highRange:number
    /** whether to fill the graph */
    fill:boolean
    /** display x axis */
    showX:boolean
    /** display y axis */
    showY:boolean
}

interface IDexcomGlucoseEntryMessage {
    received:Date
    entries:Array<IDexcomShareGlucoseEntry>
}

/** Module Socket Notification Payload */
declare type DexcomModuleNotificationPayload=IDexcomModuleConfig|IDexcomGlucoseEntryMessage

/** Module Socket Notification */
declare type DexcomModuleNotificationType='START_FETCHING'|'BLOODSUGAR_VALUES'|'STOP_FETCHING'|'AUTH_ERROR'|string

/** Trend Readings as Reported */
declare const enum DexcomTrend
{
    None=0,
    DoubleUp=1,
    SingleUp=2,
    FortyFiveUp=3,
    Flat=4,
    FortyFiveDown=5,
    SingleDown=6,
    DoubleDown=7,
    NotComputable=8,
    OutOfRange=9
}

declare interface IDexcomShareGlucose<T>
{
    /** The time */
    DT:T
    /** The time */
    ST:T
    /** The blood sugar trend */
    Trend:DexcomTrend
    /** The blood sugar value */
    Value:number
    /** The wall time for the reading */
    WT:T
}

/** Reading from Dexcom Share2 */
declare interface IDexcomShareGlucoseEntry extends IDexcomShareGlucose<Date> {
    /** The trend as a direction */
    Direction:string
    /** The trend as a unicode character */
    DirectionAsUnicode:string
}

/** Callback for firing on receipt of the glucose entries */
declare interface GlucoseEntriesReceivedCallback {
    /** @param bsgEntries {Array<IDexcomShareGlucoseEntry>} The received glucose readings */
    (bsgEntries:Array<IDexcomShareGlucoseEntry>):void
}

/** Generic logging wrapper */
declare interface ILogger {
    /** logs information */
    info(message:string):void
    /** logs warnings */
    warn(message:string):void
    /** logs errors */
    error(message:string):void
}

/** Misusing an enum to inline constants */
declare const enum ModuleDetails {
    name='mmm-dexcomshare',
    version="1.0.0"
}