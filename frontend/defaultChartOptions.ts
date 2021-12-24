import { ChartOptions } from "chart.js";

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

export default defaultChartOptions;
