'use strict'

import * as os from "os";
import request, { RequestCallback } from 'request';
import moment from 'moment';
import * as NodeHelper from "node_helper";

/** Log wrapper */
let DexcomHelperLogger:ILogger = {
    info(message: string) {console.info(`[${ModuleDetails.name}]${message}`)},
    warn(message: string) {console.warn(`[${ModuleDetails.name}]${message}`)},
    error(message: string) {console.error(`[${ModuleDetails.name}]${message}`)}
};

class GlucoseFetcher {
    config:IDexcomModuleConfig
    sessionId:string
    maxCount:number
    onGlucoseReceived:GlucoseEntriesReceivedCallback
    stopRequested:boolean

    //#region Glucose Helpers

    private trendToUnicode(trend:DexcomTrend):string {
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

    private trendToDirection(trend:DexcomTrend):string{
        switch(trend){
            case DexcomTrend.DoubleDown:
                return 'DoubleDown'
            case DexcomTrend.DoubleUp:
                return 'DoubleUp'
            case DexcomTrend.Flat:
                return 'Flat'
            case DexcomTrend.FortyFiveDown:
                return 'FortyFiveDown'
            case DexcomTrend.FortyFiveUp:
                return 'FortyFiveUp'
            case DexcomTrend.NotComputable:
                return 'NotComputable'
            case DexcomTrend.OutOfRange:
                return 'OutOfRange'
            case DexcomTrend.SingleDown:
                return 'SingleDown'
            case DexcomTrend.SingleUp:
                return 'SingleUp'
            case DexcomTrend.None:
            default:
                return 'None'
        }
    }

    private getSessionId(then:RequestCallback){
        let reqOpts: request.Options = {
            uri: `https://${this.config.server}/ShareWebServices/Services/General/LoginPublisherAccountByName`,
            json: true,
            method: 'POST',
            rejectUnauthorized: false,
            body:{
                password:this.config.password,
                applicationId:this.config.applicationId,
                accountName:this.config.userName
            },
            headers: {
                'User-Agent': "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0",
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        }
        request(reqOpts,then);
    }

    private fetchGlucose(){
        //If we've got a session id go fetch the entries
        if (this.sessionId) {
            let glucoseQuery=`sessionID=${this.sessionId}&minutes=${this.config.entryLength}&maxCount=${this.maxCount}`
            let glucoseUri=`https://${this.config.server}/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?${glucoseQuery}`
            DexcomHelperLogger.info(`Retrieving Glucose readings from ${glucoseUri}`)            
            let fetchOpts:request.Options={
                uri:glucoseUri,
                json:true,
                method:'POST',
                body:"",
                headers: {
                    'User-Agent': "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0",
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                rejectUnauthorized:false
            }
            let then:RequestCallback=(error:any,response:any,entries:Array<IDexcomShareGlucose<string>>)=>{
                if(response && response.statusCode<400){
                    let glucose = entries.map((e)=>{
                        return {
                            DT: moment(e.DT).local().toDate(),
                            ST: moment(e.ST).toDate(),
                            WT: moment(e.WT).toDate(),
                            Trend: e.Trend,
                            Value: e.Value,
                            Direction: this.trendToDirection(e.Trend),
                            DirectionAsUnicode:this.trendToUnicode(e.Trend)
                        }
                    })
                    //we should have the entries now
                    this.onGlucoseReceived(glucose)
                    DexcomHelperLogger.info(`Success! Will fetch again in ${this.config.refreshInterval} secs.`)
                    if(!this.stopRequested) {
                        setTimeout(()=>{this.fetchGlucose()},this.config.refreshInterval * 1000)
                    }
                }
                else{
                    //we need to go re-authorize and we'll come back
                    DexcomHelperLogger.info(`The session id is invalid. Refreshing...`)
                    this.sessionId=null
                    if(!this.stopRequested){
                        this.authorize()
                    }
                }
            }
            if(!this.stopRequested){
                request(fetchOpts,then)
            }
        }
        //go get the session id
        else {
            DexcomHelperLogger.info(`No session id is present. Authorizing...`)
            if(!this.stopRequested){
                this.authorize()
            }
        }
    }

    private authorize(){
        //authenticate
        this.getSessionId((err:any,res:any,body:string)=>{
            if (!err && body && res && res.statusCode == 200) {
                if(body==='00000000-0000-0000-0000-000000000000'){
                    throw 'Received an empty session id. Please check your Dexcom Credentials'
                }
                this.sessionId=body;
                DexcomHelperLogger.info(`Retrieved new Dexcom Share2 session:${this.sessionId}`)
                this.fetchGlucose()
            }
            else {
                throw 'Please check your Dexcom Credentials'
            }
        })
    }
    //#endregion

    start() {
        this.fetchGlucose()
    }
    stop() {
        this.stopRequested=true
    }

    constructor(cfg:IDexcomModuleConfig,callback:GlucoseEntriesReceivedCallback){
        //start the fetch loop
        this.config=cfg
        //since it grabs it every 5 minutes
        this.maxCount= Math.floor(cfg.entryLength/5)
        this.onGlucoseReceived=callback
    }
}

/** module helper configuration interface */
interface IDexcomNodeHelperConfig extends NodeHelper.IHelperConfig {
    fetcher:GlucoseFetcher,
    config:IDexcomModuleConfig
}

let helperConfig:IDexcomNodeHelperConfig = {
    fetcher:undefined,
    config:undefined,
    socketNotificationReceived(notification:DexcomModuleNotificationType,payload?:DexcomModuleNotificationPayload){
        if(payload)this.config=payload;
        switch (notification) {
            case "START_FETCHING":
            //Create Fetcher    
                this.fetcher=new GlucoseFetcher(this.config,(bsg)=>this.broadcastResults(bsg))
                this.fetcher.start()
                break;
            case "STOP_FETCHING":
                this.fetcher.stop()
            default:
                break;
        }
    },
    //Broadcast results
    broadcastResults(bsgValues:Array<IDexcomShareGlucoseEntry>){
        DexcomHelperLogger.info(`Received ${bsgValues.length} entries`)
        this.sendSocketNotification('BLOODSUGAR_VALUES',{received:new Date(),entries:bsgValues})
    },
    start(){
        DexcomHelperLogger.info(`Starting Module Helper version : ${ModuleDetails.version} - ${os.platform()}:${os.arch()}`);  
    },
    stop(){
        DexcomHelperLogger.info(`Stopping Module Helper...`);
        if(this.fetcher){
            this.fetcher.stop()
        }
    }
}

module.exports = NodeHelper.create(helperConfig);