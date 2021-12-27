const defaultChartOptions: Chart.ChartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  title: {
    display: false,
    text: "Blood Sugar Values (mg/dl)"
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
          unitStepSize: 30
        },
        ticks: {
          source: "auto",
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
      }
    ],
    yAxes: [
      {
        display: true,
        scaleLabel: {
          display: true,
          labelString: "mg/dL"
        },
        ticks: {
          beginAtZero: true,
          min: 30,
          max: 400
        },
        gridLines: {
          display: true
        }
      }
    ]
  },
  legend: {
    display: false,
    position: "bottom"
  },
  aspectRatio: 4 / 3
};

/** properties for the client module */
interface IDexcomModuleProperties extends IModuleProperties {
  /** subclass of the notification received event */
  notificationReceived: ModuleNotificationEvent;
  /** subclass of the socket notification received event */
  socketNotificationReceived: ISocketNotificationEvent<
    DexcomModuleNotificationType,
    IDexcomGlucoseEntryMessage<any>
  >;
  version: string;
  defaults: IDexcomModuleConfig;
  canvas?: HTMLCanvasElement;

  currentBG?: IDexcomShareGlucoseEntry;
  previousBG?: IDexcomShareGlucoseEntry;
  bgValues?: Array<IDexcomShareGlucoseEntry>;
  config?: IDexcomModuleConfig;
}

/** wrapper for the Magic Mirror logger */
const ModuleLogger: ILogger = {
  info: (m: string): void => Log.info(`[${ModuleDetails.name}] ${m}`),
  warn: (m: string): void => Log.warn(`[${ModuleDetails.name}] ${m}`),
  error: (m: string): void => Log.error(`[${ModuleDetails.name}] ${m}`)
};

const chartjsPath = "./node_modules/chart.js/dist/Chart.bundle.js";
const moduleCssPath = "./mmm-dexcomshare.css";

function renderChart(
  me: IDexcomModuleProperties,
  bgValues: IDexcomShareGlucoseEntry[]
) {
  //const me = this as IDexcomModuleProperties;
  //These should be ordered descending by time
  me.bgValues = bgValues;
  me.currentBG = bgValues[0];
  me.previousBG = bgValues[1];

  const bsgs = bgValues.map((a) => a.Value);
  const maxInSeries = Math.max.apply(bsgs.slice(0, 1), bsgs.slice(1));
  const minInSeries = Math.min.apply(bsgs.slice(0, 1), bsgs.slice(1));

  const delta = me.currentBG.Value - me.previousBG.Value;

  ModuleLogger.info(`BG Values ${me.currentBG.DirectionAsUnicode} Current:${me.currentBG.Value} Previous:${me.previousBG.Value}
          Min:${minInSeries} Max:${maxInSeries}
          Direction:${me.currentBG.Direction} ${me.currentBG.DirectionAsUnicode} Delta:${delta}`);

  const lowBgVals = bgValues
    .filter((e) => +e.Value <= me.config.lowRange)
    .map((a) => {
      return { x: a.WT, y: a.Value };
    });
  const inRangeVals = bgValues
    .filter(
      (e) => +e.Value >= me.config.lowRange && +e.Value <= me.config.highRange
    )
    .map((a) => {
      return { x: a.WT, y: a.Value };
    });
  const highVals = bgValues
    .filter((e) => +e.Value >= me.config.highRange)
    .map((a) => {
      return { x: a.WT, y: a.Value };
    });

  const bgValSpan = document.querySelector("#current-bsg-value");
  if (bgValSpan) {
    const deltaSign = delta >= 0 ? "+" : "-";

    let fontColor = "#5AB05A";
    if (me.currentBG.Value >= me.config.highRange) {
      fontColor = "#E5E500";
    } else if (me.currentBG.Value < me.config.lowRange) {
      fontColor = "#E50000";
    }

    const infoDiv = document.createElement("div");
    infoDiv.setAttribute("style", "float: left;clear: none;");

    const bs = document.createElement("div");
    bs.setAttribute("style", "display: table;");
    bs.innerHTML = `
          <span class="bright medium light" style="display: table-cell;vertical-align:top;color:${fontColor}">${me.currentBG.Value}</span>
          <span class="bright medium light" style="display: table-cell;vertical-align:top;></span>
          <span class="bright medium light" style="display: table-cell;vertical-align:top;">${me.currentBG.DirectionAsUnicode}</span>
      `;

    infoDiv.appendChild(bs);
    const deltaElem = document.createElement("div");
    deltaElem.innerHTML = `<span class="dimmed small light" style="display: table-cell;vertical-align:top;">${
      delta >= 0 ? "+" : ""
    }${delta} mg/dL</span>`;
    infoDiv.appendChild(deltaElem);
    bgValSpan.innerHTML = infoDiv.outerHTML;
  }

  const type = me.config.chartType;
  const options = me.config.chartOptions;
  if (options) {
    //we'll use the simple setting from the config if a full chartjs one wasn't given
    if (
      options.title.text === "Blood Sugar Values (mg/dl)" &&
      !options.title.display
    ) {
      options.scales.xAxes[0].display = me.config.showX;
      options.scales.yAxes[0].display = me.config.showY;
    }
    const data: Chart.ChartData = {
      datasets: [
        {
          label: `Low <= ${me.config.lowRange} mg/dL`,
          data: lowBgVals,
          borderColor: "red",
          backgroundColor: "red",
          fill: me.config.fill,
          pointRadius: 2
        },
        {
          label: "In Range",
          data: inRangeVals,
          backgroundColor: "limegreen",
          borderColor: "limegreen",
          fill: me.config.fill,
          pointRadius: 2
        },
        {
          label: `High >= ${me.config.highRange} mg/dL`,
          data: highVals,
          backgroundColor: "yellow",
          borderColor: "yellow",
          fill: me.config.fill,
          pointRadius: 2
        }
      ]
    };
    const glucoseChart = new Chart(me.canvas, {
      type,
      data,
      options
    });
  }
}

function getDexcomModuleProperties(
  name: string,
  version: string
): IDexcomModuleProperties {
  const moduleProps: IDexcomModuleProperties = {
    name,
    version,
    defaults: {
      userName: "",
      password: "",
      entryLength: 1440,
      server: "share2.dexcom.com",
      refreshInterval: 300,
      applicationId: "d89443d2-327c-4a6f-89e5-496bbb0317db",
      chartOptions: defaultChartOptions,
      chartType: "line",
      highRange: 185,
      lowRange: 70,
      fill: false,
      showX: true,
      showY: true
    },
    getScripts() {
      return [this.file(chartjsPath)];
    },
    getStyles() {
      return [this.file(moduleCssPath)];
    },
    getDom() {
      const me = this as IDexcomModuleProperties;
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
      glucoseCanvas.classList.add("magicmirror-dexcomshare-chart");
      me.canvas = glucoseCanvas;

      moduleContent.appendChild(glucoseCanvas);
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
      renderChart(this, this.bgValues);
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
      payload: IDexcomGlucoseEntryMessage<IDexcomShareGlucoseEntry>
    ) {
      const me = this as IDexcomModuleProperties;
      ModuleLogger.info(`received socket notification ${message}`);
      switch (message) {
        case "BLOODSUGAR_VALUES":
          if (payload) {
            const { received, entries } = payload;
            ModuleLogger.info(
              `Received at ${received} entries ${entries.length}`
            );
            //render the chart
            renderChart(me, entries);
          }
          break;
        case "AUTH_ERROR":
          break;
        default:
          break;
      }
    }
  };
  return moduleProps;
}

const dexcomModuleProperties = getDexcomModuleProperties(
  ModuleDetails.name,
  ModuleDetails.version
);

Module.register(ModuleDetails.name, dexcomModuleProperties);
