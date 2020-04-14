# mmm-dexcomshare
Displays readings from Dexcom Share2 on your mirror

## Configuration Options
```javascript
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
```
### Installing
```bash
git pull
npm install
```