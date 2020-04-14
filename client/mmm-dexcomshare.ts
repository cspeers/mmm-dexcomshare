'use strict'

/** wrapper for the Magic Mirror logger */
let ModuleLogger:ILogger={
    info:(m:string):void => Log.info(`[${ModuleDetails.name}] ${m}`),
    warn:(m:string):void => Log.warn(`[${ModuleDetails.name}] ${m}`),
    error:(m:string):void => Log.error(`[${ModuleDetails.name}] ${m}`)
};

interface IDexcomModuleProperties extends IModuleProperties {
    version:string
    defaults:IDexcomModuleConfig
    canvas:HTMLCanvasElement
    /** subclass of the notification received event */
    notificationReceived:ModuleNotificationEvent
    socketNotificationReceived:ISocketNotificationEvent<DexcomModuleNotificationType,IDexcomGlucoseEntryMessage>
    currentBG:IDexcomShareGlucoseEntry
    previousBG:IDexcomShareGlucoseEntry
}

const defaultChartOptions: Chart.ChartOptions = {
    responsive: true,
    title: {
        display: false,
        text: 'Blood Sugar Values (mg/dl)'
    },
    scales: {
        xAxes: [{
            type: 'time',
            display: true,
            distribution: 'series',
            time: {
                parser: 'YYYY-MM-DD HH:mm:ss',
                unit: 'minute',
                unitStepSize: 30
            },
            ticks: {
                source: 'auto',
                autoSkip: true
            },
            scaleLabel: {
                display: true,
                labelString: "Date"
            },
            gridLines: {
                display: true,
                offsetGridLines: true
            }
        }],
        yAxes: [{
            display: true,
            scaleLabel: {
                display: true,
                labelString: 'mg/dL'
            },
            ticks: {
                beginAtZero:true,
                min:30,
                max:400
            },
            gridLines: {
                display: true
            }
        }]
    },
    legend: {
        display: false,
        position: "bottom"
    }
}

let dexcomModule:IDexcomModuleProperties = {
    name:ModuleDetails.name,
    version:ModuleDetails.version,
    identifier:undefined,
    data:undefined,
    config:undefined,
    canvas:undefined,
    currentBG:undefined,
    previousBG:undefined,
    defaults:{
        userName:undefined,
        password:undefined,
        entryLength:1440,
        server:"share1.dexcom.com",
        refreshInterval:300,
        applicationId:"d89443d2-327c-4a6f-89e5-496bbb0317db",
        chartOptions:defaultChartOptions,
        chartType:'line',
        highRange:185,
        lowRange:70,
        fill:false,
        showX:true,
        showY:true
    },
    hidden:false,
    renderChart(bgValues:Array<IDexcomShareGlucoseEntry>) {
        
        //These should be ordered descending by time
        this.currentBG=bgValues[0]
        this.previousBG=bgValues[1]

        let bsgs=bgValues.map(a=>a.Value);
        let maxInSeries=Math.max.apply(bsgs.slice(0,1),bsgs.slice(1))
        let minInSeries=Math.min.apply(bsgs.slice(0,1),bsgs.slice(1))

        let delta=this.currentBG.Value - this.previousBG.Value

        ModuleLogger.info(`BG Values ${this.currentBG.DirectionAsUnicode} Current:${this.currentBG.Value} Previous:${this.previousBG.Value}
            Min:${minInSeries} Max:${maxInSeries}
            Direction:${this.currentBG.Direction}Delta:${delta}`)

        let lowBgVals=bgValues.filter(e => +e.Value <= this.config.lowRange).map(a=>{return {x:a.WT,y:a.Value}})
        let inRangeVals=bgValues.filter(e => +e.Value >= this.config.lowRange && +e.Value <=this.config.highRange).map(a=>{return {x:a.WT,y:a.Value}})
        let highVals=bgValues.filter(e => +e.Value >= this.config.highRange).map(a=>{return {x:a.WT,y:a.Value}})

        let bgValSpan=document.querySelector('#current-bsg-value')
        let deltaSign=delta>=0 ? '+' : '-'
        
        let fontColor= '#5AB05A'
        if(this.currentBG >= this.config.highRange){
            fontColor='#E5E500'
        }
        else if(this.currentBG < this.config.lowRange){
            fontColor='#E50000'
        }

        let infoDiv = document.createElement("div");
        infoDiv.setAttribute('style',"float: left;clear: none;");
        
        let bs = document.createElement("div");
        bs.setAttribute('style',"display: table;");
        bs.innerHTML =`
            <span class="bright medium light" style="display: table-cell;vertical-align:top;color:${fontColor}">${this.currentBG.Value}</span>
            <span class="bright medium light" style="display: table-cell;vertical-align:top;">${this.currentBG.DirectionAsUnicode}</span>
        `;
        
        infoDiv.appendChild(bs);
        
        let deltaElem = document.createElement("div");
        deltaElem.innerHTML=`<span class="dimmed small light" style="display: table-cell;vertical-align:top;">${deltaSign} ${delta} mg/dL</span>`
        infoDiv.appendChild(deltaElem)

        bgValSpan.innerHTML=infoDiv.outerHTML
        //we'll use the simple setting from the config if a full chartjs one wasn't given
        if(this.config.chartOptions.title.text==='Blood Sugar Values (mg/dl)' && !this.config.chartOptions.title.display){
            this.config.chartOptions.scales.xAxes[0].display=this.config.showX
            this.config.chartOptions.scales.yAxes[0].display=this.config.showY
        }

        let chartData:Chart.ChartData = {
            datasets: [
                {
                    label: `Low <= ${this.config.lowRange} mg/dL`,
                    data: lowBgVals,
                    borderColor: 'red',
                    backgroundColor:'red',
                    fill:this.config.fill,
                    pointRadius: 2
                },
                {
                    label: "In Range",
                    data: inRangeVals,
                    backgroundColor:'limegreen',
                    borderColor: 'limegreen',
                    fill:this.config.fill,
                    pointRadius: 2
                },
                {
                    label: `High >= ${this.config.highRange} mg/dL`,
                    data: highVals,
                    backgroundColor:'yellow',
                    borderColor: 'yellow',
                    fill:this.config.fill,
                    pointRadius: 2
                }
            ]
        }
        let chartConfig:Chart.ChartConfiguration={
            type: this.config.chartType,
            data: chartData,
            options: this.config.chartOptions
        }
        let glucoseChart=new Chart(this.canvas,chartConfig)
    },    
    getScripts(){
        return [
            this.file("./node_modules/chart.js/dist/Chart.bundle.js")
        ]
    },
    getStyles(){
        return [
            "mmm-dexcomshare.css"
        ]
    },
    getDom() {
        let wrapper=document.createElement('div')
        wrapper.classList.add('magicmirror-dexcomshare')

        let moduleContent=document.createElement('div')
        moduleContent.id='magicmirror-dexcomshare-content'

        let bgDetail=document.createElement('div')
        let bgNumberSpan=document.createElement('div')
        bgNumberSpan.id='current-bsg-value'
        
        bgDetail.appendChild(bgNumberSpan)

        moduleContent.appendChild(bgDetail)

        let glucoseCanvas=document.createElement('canvas')
        glucoseCanvas.id='glucoseChart'
        moduleContent.appendChild(glucoseCanvas)
        this.canvas=glucoseCanvas

        wrapper.appendChild(moduleContent)

        return wrapper;
    },
    start(){
        ModuleLogger.info(`Starting up...`);
        this.sendSocketNotification('START_FETCHING',this.config)
    },
    stop(){
        ModuleLogger.info(`Starting up...`);
    },
    suspend(){
        ModuleLogger.info(`Module Suspended...`)
    },
    resume(){
        ModuleLogger.info(`Module Resumed...`)
    },
    notificationReceived(message:ModuleNotificationType,payload:any,sender?:IModuleInstance){
        switch(message) {
            case 'MODULE_DOM_CREATED':
                break;
        }
    },
    socketNotificationReceived(message:DexcomModuleNotificationType,payload:IDexcomGlucoseEntryMessage){
        ModuleLogger.info(`received socket notification ${message}`);
        switch (message) {
            case 'BLOODSUGAR_VALUES':
                if(payload){
                    ModuleLogger.info(`Received at ${payload.received} entries ${payload.entries.length}`);
                    this.renderChart(payload.entries);
                }
                break;
            case 'AUTH_ERROR':
                break;
            default:
                break;
        }
    }
}

Module.register(ModuleDetails.name,dexcomModule)