import Chart, { ChartConfiguration, ChartData } from "chart.js";
import { ChartOptions } from "chart.js";

/** wrapper for the Magic Mirror logger */
const ModuleLogger: ILogger = {
  info: (m: string): void => Log.info(`[${ModuleDetails.name}] ${m}`),
  warn: (m: string): void => Log.warn(`[${ModuleDetails.name}] ${m}`),
  error: (m: string): void => Log.error(`[${ModuleDetails.name}] ${m}`),
};

/** properties for the client module */
interface IDexcomModuleProperties extends IModuleProperties {
  version: string;
  defaults: IDexcomModuleConfig;
  canvas: HTMLCanvasElement;
  /** subclass of the notification received event */
  notificationReceived: ModuleNotificationEvent;
  /** subclass of the socket notification received event */
  socketNotificationReceived: ISocketNotificationEvent<
    DexcomModuleNotificationType,
    IDexcomGlucoseEntryMessage
  >;
  currentBG: IDexcomShareGlucoseEntry;
  previousBG: IDexcomShareGlucoseEntry;
  bgValues: Array<IDexcomShareGlucoseEntry>;
}

const defaultChartOptions: ChartOptions = {
  responsive: false,
  maintainAspectRatio: true,
  title: {
    display: false,
    text: "Blood Sugar Values (mg/dl)",
  },
  scales: {
    xAxes: [
      {
        type: "time",
        display: true,
        distribution: "series",
        time: {
          parser: "YYYY-MM-DD HH:mm:ss",
          unit: "minute",
          unitStepSize: 30,
        },
        ticks: {
          source: "auto",
          autoSkip: true,
        },
        scaleLabel: {
          display: true,
          labelString: "Date",
        },
        gridLines: {
          display: true,
          offsetGridLines: true,
        },
      },
    ],
    yAxes: [
      {
        display: true,
        scaleLabel: {
          display: true,
          labelString: "mg/dL",
        },
        ticks: {
          beginAtZero: true,
          min: 30,
          max: 400,
        },
        gridLines: {
          display: true,
        },
      },
    ],
  },
  legend: {
    display: false,
    position: "bottom",
  },
};

const dexcomModule: IDexcomModuleProperties = {
  name: ModuleDetails.name,
  version: ModuleDetails.version,
  identifier: undefined,
  data: undefined,
  config: undefined,
  canvas: undefined,
  currentBG: undefined,
  previousBG: undefined,
  bgValues: undefined,
  defaults: {
    userName: undefined,
    password: undefined,
    entryLength: 1440,
    server: "share1.dexcom.com",
    refreshInterval: 300,
    applicationId: "d89443d2-327c-4a6f-89e5-496bbb0317db",
    chartOptions: defaultChartOptions,
    chartType: "line",
    highRange: 185,
    lowRange: 70,
    fill: false,
    showX: true,
    showY: true,
  },
  hidden: false,
  renderChart(bgValues: Array<IDexcomShareGlucoseEntry>) {
    //These should be ordered descending by time
    this.currentBG = bgValues[0];
    this.previousBG = bgValues[1];

    const bsgs = bgValues.map((a) => a.Value);
    const maxInSeries = Math.max.apply(bsgs.slice(0, 1), bsgs.slice(1));
    const minInSeries = Math.min.apply(bsgs.slice(0, 1), bsgs.slice(1));

    const delta = this.currentBG.Value - this.previousBG.Value;

    ModuleLogger.info(`BG Values ${this.currentBG.DirectionAsUnicode} Current:${this.currentBG.Value} Previous:${this.previousBG.Value}
            Min:${minInSeries} Max:${maxInSeries}
            Direction:${this.currentBG.Direction}Delta:${delta}`);

    const lowBgVals = bgValues
      .filter((e) => +e.Value <= this.config.lowRange)
      .map((a) => {
        return { x: a.WT, y: a.Value };
      });
    const inRangeVals = bgValues
      .filter(
        (e) =>
          +e.Value >= this.config.lowRange && +e.Value <= this.config.highRange
      )
      .map((a) => {
        return { x: a.WT, y: a.Value };
      });
    const highVals = bgValues
      .filter((e) => +e.Value >= this.config.highRange)
      .map((a) => {
        return { x: a.WT, y: a.Value };
      });

    const bgValSpan = document.querySelector("#current-bsg-value");
    const deltaSign = delta >= 0 ? "+" : "-";

    let fontColor = "#5AB05A";
    if (this.currentBG >= this.config.highRange) {
      fontColor = "#E5E500";
    } else if (this.currentBG < this.config.lowRange) {
      fontColor = "#E50000";
    }

    const infoDiv = document.createElement("div");
    infoDiv.setAttribute("style", "float: left;clear: none;");

    const bs = document.createElement("div");
    bs.setAttribute("style", "display: table;");
    bs.innerHTML = `
            <span class="bright medium light" style="display: table-cell;vertical-align:top;color:${fontColor}">${this.currentBG.Value}</span>
            <span class="bright medium light" style="display: table-cell;vertical-align:top;">${this.currentBG.DirectionAsUnicode}</span>
        `;

    infoDiv.appendChild(bs);

    const deltaElem = document.createElement("div");
    deltaElem.innerHTML = `<span class="dimmed small light" style="display: table-cell;vertical-align:top;">${deltaSign} ${delta} mg/dL</span>`;
    infoDiv.appendChild(deltaElem);

    bgValSpan.innerHTML = infoDiv.outerHTML;
    //we'll use the simple setting from the config if a full chartjs one wasn't given
    if (
      this.config.chartOptions.title.text === "Blood Sugar Values (mg/dl)" &&
      !this.config.chartOptions.title.display
    ) {
      this.config.chartOptions.scales.xAxes[0].display = this.config.showX;
      this.config.chartOptions.scales.yAxes[0].display = this.config.showY;
    }

    const chartData: ChartData = {
      datasets: [
        {
          label: `Low <= ${this.config.lowRange} mg/dL`,
          data: lowBgVals,
          borderColor: "red",
          backgroundColor: "red",
          fill: this.config.fill,
          pointRadius: 2,
        },
        {
          label: "In Range",
          data: inRangeVals,
          backgroundColor: "limegreen",
          borderColor: "limegreen",
          fill: this.config.fill,
          pointRadius: 2,
        },
        {
          label: `High >= ${this.config.highRange} mg/dL`,
          data: highVals,
          backgroundColor: "yellow",
          borderColor: "yellow",
          fill: this.config.fill,
          pointRadius: 2,
        },
      ],
    };
    const chartConfig: ChartConfiguration = {
      type: this.config.chartType,
      data: chartData,
      options: this.config.chartOptions,
    };
    const glucoseChart = new Chart(this.canvas, chartConfig);
  },
  getScripts() {
    return [this.file("./node_modules/chart.js/dist/Chart.bundle.js")];
  },
  getStyles() {
    return ["mmm-dexcomshare.css"];
  },
  getDom() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("magicmirror-dexcomshare");

    const moduleContent = document.createElement("div");
    moduleContent.id = "magicmirror-dexcomshare-content";

    const bgDetail = document.createElement("div");
    const bgNumberSpan = document.createElement("div");
    bgNumberSpan.id = "current-bsg-value";

    bgDetail.appendChild(bgNumberSpan);

    moduleContent.appendChild(bgDetail);

    const glucoseCanvas = document.createElement("canvas");
    glucoseCanvas.id = "glucoseChart";
    moduleContent.appendChild(glucoseCanvas);
    this.canvas = glucoseCanvas;

    wrapper.appendChild(moduleContent);
    return wrapper;
  },
  start() {
    ModuleLogger.info(`Starting up...`);
    this.sendSocketNotification("START_FETCHING", this.config);
  },
  stop() {
    ModuleLogger.info(`Starting up...`);
  },
  suspend() {
    ModuleLogger.info(`Module Suspended...`);
  },
  resume() {
    ModuleLogger.info(`Module Resumed...`);
    this.renderChart(this.bgValues);
  },
  notificationReceived(
    message: ModuleNotificationType,
    payload: any,
    sender?: IModuleInstance
  ) {
    switch (message) {
      case "MODULE_DOM_CREATED":
        break;
    }
  },
  socketNotificationReceived(
    message: DexcomModuleNotificationType,
    payload: IDexcomGlucoseEntryMessage
  ) {
    ModuleLogger.info(`received socket notification ${message}`);
    switch (message) {
      case "BLOODSUGAR_VALUES":
        if (payload) {
          ModuleLogger.info(
            `Received at ${payload.received} entries ${payload.entries.length}`
          );
          this.bgValues = payload.entries;
          this.renderChart(this.bgValues);
        }
        break;
      case "AUTH_ERROR":
        break;
      default:
        break;
    }
  },
};

Module.register(ModuleDetails.name, dexcomModule);
