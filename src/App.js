import logo from './logo.svg';
import './App.css';
import { useEffect, useState, createRef, Ref, componentDidMount } from 'react';
import * as web3 from '@solana/web3.js';
import { Input, FormControl, FormLabel, FormHelperText, Button } from '@chakra-ui/react'
import DatePicker from "react-datepicker";
// import "react-datepicker/dist/react-datepicker.css";
// import "./date-picker.css"
import DateTimePicker from 'react-datetime-picker';
import cytoscape from 'cytoscape';
import { InfluxDB, Point } from '@influxdata/influxdb-client'
import style from './style.js'


function App() {

  const INFLUX_URL= "http://localhost:8086"
  const INFLUX_TOKEN= "yIWsf2U--YECKMyimLSfeE3VEFvKQW7AEN9tHt4huzZAHk1ORcZ0jRQO3O96ubPY9dG-H_VEJ8qlKa4Y3f8Utw=="
  const INFLUX_ORG= "solana"
  const INFLUX_BUCKET= "test_bucket"

  const queryApi = new InfluxDB({url: INFLUX_URL, token: INFLUX_TOKEN}).getQueryApi(INFLUX_ORG)


  const [connection, setConnection] = useState(null)
  const [startDate, setStartDate] = useState(new Date((new Date()).getTime() + (new Date()).getTimezoneOffset() * 60000))
  const [unixTime, setUnixTime] = useState(null)
  const [graphData, setGraphData] = useState([])
  const [cy, setCy] = useState(null)

  useEffect(() => {

    getConnection()


  },[])

  useEffect(() => {

  },[graphData])


  const getUnixTime = () => {
    console.log('startdate', startDate)
    let unixTime = parseInt((startDate.getTime() / 1000).toFixed(0))
    console.log('unixTime', unixTime)
    setUnixTime(unixTime)
  }

  const searchBlockTime = async () => {
    // let currentSlot = await connection.getSlot()
    let genesisBlockTime = await connection.getBlockTime(0)
    console.log('blcoktime slot 0', genesisBlockTime)

    console.log(Math.floor((unixTime - genesisBlockTime) * 1.666))
    let estimatedSlot = Math.floor((unixTime - genesisBlockTime) * 1.666) //estimated number of slots between genesis and our unix time
    // let estimatedTime = genesisBlockTime + Math.floor((unixTime - genesisBlockTime) * 1.666) //want to calculate slot number at our unix time
    // console.log('estimatedTime', estimatedTime)
    // let blockOfSlot = await connection.getBlock(estimatedSlot)
    let estimatedBlockTime = await connection.getBlockTime(estimatedSlot)
    let estimatedBlock = await connection.getBlock(estimatedSlot)
    console.log('estimatedBlockTime', estimatedBlockTime)
    console.log('estimatedBlock', estimatedBlock)

  }

  const getAnalytics = () => {
    // searchBlockTime()

    // [ // list of graph elements to start with
    //     { // node a
    //       data: { id: 'a' }
    //     },
    //     { // node b
    //       data: { id: 'b' }
    //     },
    //     { // edge ab
    //       data: { id: 'ab', source: 'a', target: 'b' }
    //     }
    //   ]

    console.log('startDate', startDate)

    const fluxQuery = "from(bucket: \"test_bucket\") |> range(start: -10d) |> filter(fn: (r) => r._measurement == \"test_measurement_1\" and (r._field == \"parents\" or r._field == \"descendants\" or r._field == \"new_root\")) |> pivot(rowKey:[\"_time\"], columnKey:[\"_field\"], valueColumn:\"_value\") |> drop(fn: (column) => column == \"_start\" or column == \"_stop\")"
    const data = []
    const fluxObserver = {
      next(row, tableMeta) {
        const o = tableMeta.toObject(row)
        console.log(
          `${o._time} ${o._measurement} in table ${o.table}: ${o.descendants}`
        )

        data.push({
          data: { id: o.new_root, label: o.new_root, name: o.new_root }
        })

        // if(o.table == 1){
        //   console.log('here?', data)
          
        // }
      },
      error(error) {
        console.error(error)
        console.log('\nFinished ERROR')
      },
      complete() {
        console.log('\nFinished SUCCESS')
        setGraphData(data)
        constructGraph(data)
      }
    }

    queryApi.queryRows(fluxQuery, fluxObserver)
    // console.log('data', data[0])
    // console.log('data', data.length)

    // cy.startBatch();

    // let added = cy.add([{ id: 'c' }])

    // cy.endBatch();

    // console.log('added', added

  }

  const constructGraph = (data) => {

    // console.log('graphData', graphData)
    // console.log('graphData', graphData.length)

    const div1 = document.createElement("div");
    const div2 = document.createElement("div");
    div1.id ='parent_cy'
    div2.id='cy'
    
    div1.appendChild(div2);
    document.body.appendChild(div1);

    // console.log('here', document.getElementById('graph_div'))

    let cy = window.cy = cytoscape({
      container: document.getElementById('cy'), // container to render in
      elements: data,
      style: [ // the stylesheet for the graph
        {
          selector: 'node',
          style: {
            'width': '40',
            'height': '40',
            'font-size': '9',
            'font-weight':' bold',
            'min-zoomed-font-size':' 4',
            'label':' data(name)',
            'text-wrap':' wrap',
            'text-max-width':' 50',
            'text-valign':' center',
            'text-halign':' center',
            'text-events':' yes',
            'color':' #000'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'grid',
        rows: 1
      },
      wheelSensitivity:0.05
    });

    setCy(cy)

  }

  const getConnection = async () => {
    let connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');
    setConnection(connection)
    // let cy = cytoscape({
    //   container: graph // container to render in
    // });

  }



  return (
    <div className="App">
      <header className="App-header">

        {/* <Input placeholder='Enter Date' /> */}
        {/* <div style={{width:'50vw', backgroundColor:'black'}}>
          <DatePicker 
            selected={startDate} 
            onChange={(date) => setStartDate(date)} 
            showTimeSelect
            style={{height:'10vh'}}
          />
          <FormControl>
            {startDate && <FormLabel htmlFor="published-date">{startDate.toDateString()}</FormLabel>}
            <DatePicker
              id="published-date"
              selectedDate={startDate}
              onChange={(date) => {console.log('date', date);}}
              showPopperArrow={true}
              showTimeSelect
            />
          </FormControl>
        </div> */}
        <div style={{display:'flex', flexDirection:'column', justifyContent:'space-around', alignItems:'center', height:'30vh', width:'40vw'}}>
          <div style={{display: 'flex', flexWrap: 'wrap', justifyContent:'space-around', alignItems:'center', width:'80%'}}>
            <DateTimePicker 
              onChange={(date) => {
                let now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
                setStartDate(new Date(now_utc))}}
              value={startDate} 
              amPmAriaLabel="Select AM/PM"
              calendarAriaLabel="Toggle calendar"
              clearAriaLabel="Clear value"
              dayAriaLabel="Day"
              hourAriaLabel="Hour"
              maxDetail="second"
              minuteAriaLabel="Minute"
              monthAriaLabel="Month"
              nativeInputAriaLabel="Date and time"
              secondAriaLabel="Second"
              yearAriaLabel="Year"
              disableCalendar={true}
              disableClock={true}
            />
            <Button style={{backgroundColor:'transparent', border:'solid', borderWidth:'0.1em'}} onClick={getUnixTime}>Unix Time</Button>
          </div>
          <div>
            <Button style={{backgroundColor:'transparent', border:'solid', borderWidth:'0.1em'}} onClick={getAnalytics}>Get Analytics</Button>
          </div>
          {/* <div ref={graph}>

          </div> */}
        </div>
      </header>
    </div>
  );
}

export default App;
