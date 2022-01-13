const DEFAULT_DEXCOM_SERVER = "share2.dexcom.com";
const DEFAULT_DEXCOM_APPID = "d89443d2-327c-4a6f-89e5-496bbb0317db";

const chartjsPath = "./node_modules/chart.js/dist/Chart.bundle.js";
const moduleCssPath = "./mmm-dexcomshare.css";

/** wrapper for the Magic Mirror logger */
const ModuleLogger: ILogger = {
  info: (m: string): void => Log.info(`[${ModuleDetails.name}] ${m}`),
  warn: (m: string): void => Log.warn(`[${ModuleDetails.name}] ${m}`),
  error: (m: string): void => Log.error(`[${ModuleDetails.name}] ${m}`)
};

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

function bsgToChartPoint(a: IDexcomShareGlucoseEntry): Chart.ChartPoint {
  return { x: a.WT, y: a.Value };
}

function renderInfoDiv(
  currentBG: IDexcomShareGlucoseEntry,
  previousBG: IDexcomShareGlucoseEntry,
  config: IDexcomModuleConfig,
  bgValSpan: Element
) {
  if (bgValSpan) {
    const delta = currentBG.Value
      ? currentBG.Value - previousBG?.Value ?? 0
      : 0;
    const deltaSign = delta >= 0 ? "+" : "-";

    let fontColor = "#5AB05A";
    if (currentBG.Value >= config.highRange) {
      fontColor = "#E5E500";
    } else if (currentBG.Value < config.lowRange) {
      fontColor = "#E50000";
    }

    const infoDiv = document.createElement("div");
    infoDiv.setAttribute("style", "float: left;clear: none;");

    const bs = document.createElement("div");
    bs.setAttribute("style", "display: table;");
    bs.innerHTML = `
    <span class="bright medium light currentbsg" style="color:${fontColor}">${
      currentBG?.Value?.toString() ?? "???"
    }</span>
    <span class="bright medium light currentbsg"/>
    <span class="bright medium light currentbsg">${
      currentBG?.DirectionAsUnicode ?? "-"
    }</span>
`;

    infoDiv.appendChild(bs);
    const deltaElem = document.createElement("div");
    deltaElem.innerHTML = `<span class="dimmed small light bsgvalue">${deltaSign}${delta} mg/dL</span>`;
    infoDiv.appendChild(deltaElem);

    bgValSpan.innerHTML = infoDiv.outerHTML;
  }
  return bgValSpan;
}

function bsgToChartData(
  config: IDexcomModuleConfig,
  bgValues: IDexcomShareGlucoseEntry[]
): Chart.ChartData {
  console.debug(`Current Values`, bgValues);
  const glucose = bgValues.reduce<GlucoseDataSets>(
    (acc, bsg) => {
      if (bsg.Value) {
        if (bsg.Value <= config.lowRange) {
          acc.low.push(bsgToChartPoint(bsg));
        } else if (
          bsg.Value >= config.lowRange &&
          bsg.Value <= config.highRange
        ) {
          acc.inRange.push(bsgToChartPoint(bsg));
        } else if (bsg.Value >= config.highRange) {
          acc.high.push(bsgToChartPoint(bsg));
        }
      }
      return acc;
    },
    { low: [], inRange: [], high: [] }
  );
  return {
    datasets: [
      {
        label: `Low <= ${config.lowRange} mg/dL`,
        data: glucose.low,
        borderColor: "red",
        backgroundColor: "red",
        fill: config.fill,
        pointRadius: 2
      },
      {
        label: "In Range",
        data: glucose.inRange,
        backgroundColor: "limegreen",
        borderColor: "limegreen",
        fill: config.fill,
        pointRadius: 2
      },
      {
        label: `High >= ${config.highRange} mg/dL`,
        data: glucose.high,
        backgroundColor: "yellow",
        borderColor: "yellow",
        fill: config.fill,
        pointRadius: 2
      }
    ]
  };
}

function renderChart(
  config: IDexcomModuleConfig,
  canvas: HTMLCanvasElement,
  bgValues: IDexcomShareGlucoseEntry[]
) {
  const type = config.chartType ?? "line";
  const options = config.chartOptions ?? defaultChartOptions;
  const data = bsgToChartData(config, bgValues);

  //we'll use the simple setting from the config if a full chartjs one wasn't given
  if (
    options.title.text === "Blood Sugar Values (mg/dl)" &&
    !options.title.display
  ) {
    options.scales.xAxes[0].display = config.showX;
    options.scales.yAxes[0].display = config.showY;
  }
  const glucoseChart = new Chart(canvas, {
    type,
    data,
    options
  });
  return glucoseChart;
}

function renderModule(
  me: IDexcomModuleProperties,
  bgValues: IDexcomShareGlucoseEntry[]
) {
  const now = new Date();
  const { config, canvas } = me;
  //These should be ordered descending by time
  const currentBG = bgValues[0];
  const previousBG = bgValues[1];

  //is the latest value less than 10 mins. old?
  if (currentBG.WT > moment(now).subtract(10, "minutes").toDate()) {
    me.currentBG = currentBG;
    me.previousBG = previousBG;
    me.bgValues = bgValues;
  } else {
    ModuleLogger.warn(`Previous entry older than 10 minutes...`);
    //create ghost entries for the missing time...
    const revals: IDexcomShareGlucoseEntry[] = [];
    const minsSinceValue = moment(now).diff(moment(currentBG.WT), "minutes");
    for (let index = 0; index < Math.floor(minsSinceValue / 5) - 1; index++) {
      const el: IDexcomShareGlucoseEntry = {
        DT: moment(now)
          .subtract(5 * (index + 1), "minutes")
          .local()
          .toDate(),
        ST: moment(now)
          .subtract(5 * (index + 1), "minutes")
          .toDate(),
        WT: moment(now)
          .subtract(5 * (index + 1), "minutes")
          .toDate(),
        Direction: "NOT COMPUTABLE",
        DirectionAsUnicode: "-",
        Trend: DexcomTrend.NotComputable
      };
      revals.push(el);
    }
    me.currentBG = revals[0];
    me.previousBG = currentBG;
    me.bgValues = [...revals, ...bgValues];
  }

  const bsgs = me.bgValues.filter((a) => a.Value).map((a) => a.Value);
  const maxInSeries = Math.max.apply(bsgs.slice(0, 1), bsgs.slice(1));
  const minInSeries = Math.min.apply(bsgs.slice(0, 1), bsgs.slice(1));
  ModuleLogger.info(`BG Values ${me.currentBG.DirectionAsUnicode} Current:${
    me.currentBG.Value
  } Previous:${me.previousBG.Value}
          Min:${minInSeries} Max:${maxInSeries}
          Direction:${me.currentBG.Direction} ${
    me.currentBG.DirectionAsUnicode
  } Delta:${me.currentBG ? me.currentBG.Value - me.previousBG.Value : 0}`);
  const bgValSpan = document.querySelector("#current-bsg-value");
  renderInfoDiv(me.currentBG, me.previousBG, config, bgValSpan);
  renderChart(config, canvas, bgValues);
}

function getDom(me: IDexcomModuleProperties) {
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
      server: DEFAULT_DEXCOM_SERVER,
      refreshInterval: 300,
      applicationId: DEFAULT_DEXCOM_APPID,
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
      return getDom(this);
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
      renderModule(this.config, this.bgValues);
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
            ModuleLogger.info(`${received} ${entries.length} entries`);
            renderModule(me, entries);
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
