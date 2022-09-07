import logo from './logo.svg';
import './App.css';
import { useEffect, useState, createRef, Ref, componentDidMount } from 'react';
import * as web3 from '@solana/web3.js';
import { Input, FormControl, FormLabel, FormHelperText, Button, Select, CloseButton } from '@chakra-ui/react'
import DatePicker from "react-datepicker";
import DateTimePicker from 'react-datetime-picker';
import { InfluxDB, Point } from '@influxdata/influxdb-client'
import style from './style.js'
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import Draggable from 'react-draggable'; 
import Graph from "react-graph-vis";
import _ from "lodash";
import { VscDebugStart, VscDebugPause } from 'react-icons/vsc'


function App() {

  const INFLUX_URL = process.env.REACT_APP_INFLUX_URL
  const INFLUX_TOKEN = process.env.REACT_APP_INFLUX_TOKEN
  const INFLUX_ORG = process.env.REACT_APP_INFLUX_ORG
  const INFLUX_BUCKET = process.env.REACT_APP_INFLUX_BUCKET
  const VALIDATOR_PUBKEY = process.env.REACT_APP_VALIDATOR_PUBKEY
  const graph_options = {
    layout: {
      hierarchical: false
    },
    edges: {
      color: "#000000",
      length: 20,

    },
    nodes: {
      borderWidth: 0,
      shape: 'circle',
      value: 10,
    },
    physics: {
      stabilization: {
        enabled: true,
        iterations: 100,
      },
      barnesHut: {
        springConstant: 0.03,
      }
    },
  };

  const randomColor = () => {
    const sol_colors = ['rgb(0, 255, 163)', 'rgb(3, 225, 255)', 'rgb(220, 31, 255)']
    return sol_colors[Math.ceil(Math.random()*3)-1];
  }


  const queryApi = new InfluxDB({url: INFLUX_URL, token: INFLUX_TOKEN}).getQueryApi(INFLUX_ORG)

  const [connection, setConnection] = useState(null)
  const [startDate, setStartDate] = useState(new Date())
  const [unixTime, setUnixTime] = useState(1659850506)
  const [graphData, setGraphData] = useState([])
  const [timeouts, setTimeouts] = useState([])

  const [measurements, setMeasurements] = useState([])
  const [delayHandler, setDelayHandler] = useState(null)
  const [showVoteHistoryModal, setShowVoteHistoryModal] = useState(false)
  // This should be the validator that you are running core Fork-vis code on
  const [currentValidator, setCurrentValidator] = useState(VALIDATOR_PUBKEY)
  const [selectedVoteViewValidator, setSelectedVoteViewValidator] = useState(null)
  const [voteHistory, setVoteHistory] = useState({})
  const [completeVoteHistory, setCompleteVoteHistory] = useState({})
  const [network, setNetwork] = useState(undefined)
  const [showNodeSelectorModal, setShowNodeSelectorModal] = useState(undefined)
  const [nodeInfo, setNodeInfo] = useState({})
  const [currentGraphTime, setCurrentGraphTime] = useState(undefined)
  const [graphStateNodes, setGraphStateNodes] = useState([])
  const [graphStateEdges, setGraphStateEdges] = useState([])
  const [graphCounter, setGraphCounter] = useState({})
  const [futureGraphState, setFutureGraphState] = useState([])
  const [currentReplayParents, setCurrentReplayParents] = useState([])
  const [currentReplayDescendants, setCurrentReplayDescendants] = useState([])
  const [currentReplayTips, setCurrentReplayTips] = useState([])
  
  // const [leftToReplay, setLeftToReplay] = useState([])

  const [graphState, setGraphState] = useState({
    counter: 0,
    graph: {
      nodes: [],
      edges: []
    },
    events: {
      select: ({ nodes, edges }) => {
        console.log("Selected nodes:");
        console.log(nodes);
        setShowNodeSelectorModal(nodes[0])
      },
    }
  })

  const { graph, events } = graphState;

  // Upon network loading, stabilize the graph
  useEffect(()=>{
    if(network){
      network.once('stabilized', () => {
        network.fit({
          animation: {
            duration: 2000
          }
        })
      })
      network.stabilize(100);
    }
  }, [network])

  // Upon initial load, get measurement data
  useEffect(() => {
    getAnalytics(true, currentValidator)
  },[])


  const getUnixTime = () => {
    let unixTime = parseInt((startDate.getTime() / 1000).toFixed(0))
    setUnixTime(unixTime)
    return unixTime
  }

  // const getMeasurements = (firstLoad=false) => {
  //   const measurementsQuery = `import \"influxdata/influxdb/schema\" \n schema.measurements(bucket: \"${INFLUX_BUCKET}\")`
  //   console.log('measurements query', measurementsQuery)
  //   const measurements = []
  //   const queryMeasurementsObserver = {
  //     next(row, tableMeta) {
  //       const o = tableMeta.toObject(row)
  //       try {
  //         new web3.PublicKey(o._value)
  //         measurements.push(o._value)
  //       } catch (e) {
  //         return
  //       }
  //     },
  //     error(error) {
  //       console.log('Measurements Finished ERROR', error)
  //     },
  //     complete() {
  //       console.log('Measurements Finished SUCCESS', measurements)
  //       setMeasurements(measurements)
  //       if (measurements[measurements.length-1]) getAnalytics(true, currentValidator)
  //     }
  //   }
  //   queryApi.queryRows(measurementsQuery, queryMeasurementsObserver)
  // }

  const getAnalytics = (firstLoad=false, currentValidator, unixTime, test_fork=false) => {

    setCurrentValidator(currentValidator)
    let isFirst = firstLoad ? "|> last() " : "undefined"

    const fluxQuery = firstLoad ? 
      `from(bucket: \"${INFLUX_BUCKET}\") |> range(start: -20d) |> filter(fn: (r) => r._measurement == "${currentValidator}" and (r._field == "parents" or r._field == "descendants" or r._field == "new_root" or r._field == "relative_stakes" or r._field == "total_stakes" or r._field== "pubkey" or r._field== "leader_nodes" or r._field == "vote_history")) ${isFirst} |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> drop(fn: (column) => column == "_start" or column == "_stop") |> limit(n: 20)` 
        :
      `from(bucket: \"${INFLUX_BUCKET}\") |> range(start: ${unixTime}) |> filter(fn: (r) => r._measurement == "${currentValidator}" and (r._field == "parents" or r._field == "descendants" or r._field == "new_root" or r._field == "relative_stakes" or r._field == "total_stakes" or r._field== "pubkey" or r._field== "leader_nodes" or r._field == "vote_history")) |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> drop(fn: (column) => column == "_start" or column == "_stop") |> limit(n: 20)`

    console.log('fluxQuery: ', fluxQuery)
    const data = []
    let validator_pubkey
    const nodeInfoObj = {}
  
    const graphStateNodes = []
    const graphStateEdges = []
    const futureGraphArr = []
    const currentGraphSlotNumbers = []
    const tips = {}
    let counter = 0 
    let graphTime
    let descendants
    let parents 
    let lastnode
    const fluxObserver = {
      next(row, tableMeta) {

        if(counter === 0){
          const o = tableMeta.toObject(row)
          console.log(
            `${o._time} ${o._measurement} in table ${o.table}: ${o.descendants}, ${o.parents}`
          )

          setCurrentGraphTime(o._time)
          graphTime = o._time
          data.push({
            data: { id: o.new_root, label: o.new_root, name: o.new_root }
          })
          graphStateNodes.push({ id: o.new_root, label: o.new_root, color: randomColor() })
          descendants = o.descendants.trim().split(" ")
          parents = o.parents.trim().split(" ")
          let relative_stakes = o.relative_stakes.trim().split(" ")
          let total_stakes = o.total_stakes.trim().split(" ")
          let leader_nodes = o.leader_nodes.trim().split(" ")
          let vote_history_arr = o.vote_history.trim().split(" ")
          let vote_history = {}
          validator_pubkey = o.pubkey
          let tracker_obj = {}

          nodeInfoObj[o.new_root] = {root: true}
          nodeInfoObj["counter"] = parseInt(o.new_root)

          descendants.forEach((ele, idx)=> {
            if(!parents.includes(ele)){
              nodeInfoObj[ele] = {root: false, leader: leader_nodes[idx], tip: true}
              tips[ele] = 0
            }
            else {
              nodeInfoObj[ele] = {root: false, leader: leader_nodes[idx], tip: false}
            }
            currentGraphSlotNumbers.push(parseInt(ele))
          })

          vote_history_arr.forEach((ele,idx) => {
            let trimmed = ele.slice(1,ele.length-1).split(",")
            vote_history[parseInt(trimmed[1])] = trimmed[0]
          })

          setVoteHistory(vote_history)


          let sorted_descendants =[...descendants].sort((a,b) => {
            if(parseInt(a) > parseInt(b)){
              return 1
            } else if (parseInt(a) < parseInt(b)) {
              return -1
            } else {
              return 0
            }
          })

          sorted_descendants.forEach((ele, idx) => {
            graphStateNodes.push({id: ele, label: `${ele}`, color: randomColor() })
            if(idx = sorted_descendants.length - 1){
              lastnode = ele
            }
          })

          parents.forEach((ele, idx) => {
            graphStateEdges.push({from: ele, to: descendants[idx]})
          })

          counter += 1

        } else {

          const o = tableMeta.toObject(row)

          let futuredescendants = o.descendants.trim().split(" ")
          let futureparents = o.parents.trim().split(" ")

          let leader_nodes = o.leader_nodes.trim().split(" ")
          let vote_history_arr = o.vote_history.trim().split(" ")
          let vote_history = {}

          vote_history_arr.forEach((ele,idx) => {
            let trimmed = ele.slice(1,ele.length-1).split(",")
            vote_history[parseInt(trimmed[1])] = trimmed[0]
          })

          futuredescendants.forEach((ele, idx) => {
            if(!currentGraphSlotNumbers.includes(parseInt(ele))){
              futureGraphArr.push({id: ele, from: futureparents[idx], to: ele, new_root: o.new_root, leader: leader_nodes[idx], time: o._time, vote_history})
              currentGraphSlotNumbers.push(parseInt(ele))
            }
          })

        }
      },
      error(error) {
        console.error(error)
        console.log('Finished ERROR')
      },
      complete() {
        console.log('Finished SUCCESS')
        setFutureGraphState(futureGraphArr)

        setGraphState(({ graph: { nodes, edges }, counter, ...rest}) => {
          return {
            graph: {
              nodes: [
                ...graphStateNodes,
              ],
              edges: [
                ...graphStateEdges,
              ]
            },
            counter: parseInt(lastnode),
            ...rest
          }
        })

        if(network){
          network.fit()
        }

        calculateStakes(graphTime, nodeInfoObj, tips, descendants, parents, lastnode)

      }
    }

    queryApi.queryRows(fluxQuery, fluxObserver)

  }

  const calculateStakes = (time, nodeInfoObj, tips, descendants, parents, lastnode) => {
    let minutestr = ""
    let decrement = parseInt(time.slice(17, 19)) - 1
    let starttime
    if (decrement === -1){
      starttime = time.slice(0, 20) + "00000Z"
    }
    else if((decrement).toString().length === 1){
      minutestr = "0" + (parseInt(time.slice(17, 19)) - 1).toString()
      let lastfrag = time.split(".")
      starttime = time.slice(0, 17) + minutestr + "." + lastfrag[lastfrag.length-1]
    } else {
      minutestr = decrement
      let lastfrag = time.split(".")
      starttime = time.slice(0, 17) + minutestr + "." + lastfrag[lastfrag.length-1]
    }
  

    const fluxQuery =`from(bucket: \"${INFLUX_BUCKET}\") |> range(start: ${starttime}, stop:${time}) |> filter(fn: (r) => r._measurement == "tower_stats" and (r._field == "validators" or r._field == "recent_votes" or r._field == "vote_histories" or r._field == "stakes")) |> last() |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> drop(fn: (column) => column == "_start" or column == "_stop")`
  
    const completeVoteHistory = {}
    const fluxObserver = {

      next(row, tableMeta) {

        const o = tableMeta.toObject(row)
        let validators = o.validators.trim().split(" ")
        let stakes = o.stakes.trim().split(" ")
        let recent_votes = o.recent_votes.trim().split(" ")
        let vote_histories = o.vote_histories.trim().split(" ")
        
        setSelectedVoteViewValidator(validators[0])
        setMeasurements(validators)

        validators.forEach((validator,idx) => {
          let vote_history = {}

          vote_histories.forEach((ele,idx) => {
            let coordinates = ele.slice(1, ele.length-1).split(')(')
            coordinates.forEach((coordinate,idx) => {
              let trimmed = coordinate.split(",")
              vote_history[parseInt(trimmed[1])] = trimmed[0]
            })
          })
          completeVoteHistory[validator] = vote_history
        })

        recent_votes.forEach((vote,idx) => {
          let foundtips = findTips(vote, descendants, parents, Object.keys(tips))
          foundtips.forEach(ele => {
            tips[ele] += parseInt(stakes[idx])
          })
          
        })
      },
      error(error) {
        console.log('Finished ERROR', error)
      },
      complete() {
        console.log('Finished SUCCESS', nodeInfoObj)
        setCompleteVoteHistory(completeVoteHistory)
        Object.keys(tips).forEach(slot => {
          nodeInfoObj[slot].stake = tips[slot]
        })
        nodeInfoObj["counter"] = parseInt(lastnode)
        setNodeInfo(nodeInfoObj)
      }
    }
  
    queryApi.queryRows(fluxQuery, fluxObserver)
  
  }

  const findTips = (vote, descendants, parents, tips) => {
    if(tips.includes(vote)){
      return vote
    }

    const recurse = (tocheck, listoftips) => {
      const newtocheck = []
      for (const ele of tocheck) {
        if(tips.includes(ele)){
          listoftips.push(ele)
        }
        parents.forEach((parent,idx) => {
          if (ele === parent){
            newtocheck.push(descendants[idx])
          }
        })
      }
      if(newtocheck.length == 0){ return listoftips }
      return recurse(newtocheck.slice(), listoftips.slice())
    }

    return recurse([vote], [])

  }

  const pauseReplay = () => {
    timeouts.forEach(timeout => {
      clearTimeout(timeout)
    })
  }

  const renderVoteHistory = () => {
    const vote_history = []
    for(let i=31; i>0; i--){
      if(completeVoteHistory[selectedVoteViewValidator]){
        vote_history.push(<div key={i}>slot {completeVoteHistory[selectedVoteViewValidator][i]} {'('} conf = {i} {')'}</div>)
      }
    }

    return vote_history
  }

  const renderOptions = () => {
    const options = []
    measurements.forEach((ele,idx) => {
      options.push(<option value={ele} key={idx}>{ele}</option>)
    })
    return options
  }

  const renderNodeInfo = () => {
    const divs = []
    if(Object.keys(nodeInfo).length !== 0){
      const currentInfo = nodeInfo[showNodeSelectorModal]
      divs.push(<div>Slot {showNodeSelectorModal}</div>)
      Object.keys(currentInfo).forEach((ele) => {
        console.log('ele', ele, currentInfo, currentInfo[ele])
        divs.push(<div>{ele} : {currentInfo[ele].toString()}</div>)
      })
    }
    return divs
  }

  const replayEvents = () => {

    const timeouts_arr = []
    futureGraphState.forEach((ele, idx) => {

      timeouts_arr.push(setTimeout(() => {
        setGraphState(({ graph: { nodes, edges }, counter, ...rest }) => {
          const id = counter + 1;
          const from = Math.floor(Math.random() * (counter - 1)) + 1;
          return {
            graph: {
              nodes: [
                ...nodes,
                { id: ele.id, label: `${ele.id}`, color: randomColor()}
              ],
              edges: [
                ...edges,
                { from: ele.from, to: ele.to }
              ]
            },
            counter: id,
            ...rest
          }
        })

        console.log('nodeinfo debug', nodeInfo)
        setNodeInfo(({ [ele.new_root]: { root, ...oldRoot }, counter, [counter-1] : { tip, stake, ...oldTip }, ...rest}) => {
          console.log('ele', ele, counter)
          const length = counter + 1;
          return {
            [ele.new_root]: {
              root: true,
              ...oldRoot
            },  
            [ele.id]: {
              root:false,
              leader: ele.leader,
              tip:true
            },
            [counter-1]: {
              tip: false,
              stake:null,
              ...oldTip
            },
            counter: length,
            ...rest 
          }
        })

        setCurrentGraphTime(ele.time)

        setVoteHistory(ele.vote_history)

        futureGraphState.shift()


      }, idx*1000))

      setTimeouts(timeouts_arr)

    })  
  
  }

  // const manualCalculateStakes = () => {

  //   let minutestr = ""
  //   let decrement = parseInt(currentGraphTime.slice(17, 19)) - 1
  //   if((decrement).toString().length === 1){
  //     minutestr = "0" + (parseInt(currentGraphTime.slice(17, 19)) - 1).toString()
  //   } else {
  //     minutestr = decrement
  //   }
  //   let starttime = currentGraphTime.slice(0, 17) + minutestr + currentGraphTime.slice(-8)

  //   const fluxQuery =`from(bucket: "test_bucket_2") |> range(start: ${starttime}, stop:${currentGraphTime}) |> filter(fn: (r) => r._measurement == "tower_stats" and (r._field == "validators" or r._field == "recent_votes" or r._field == "vote_histories" or r._field == "stakes")) |> last() |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value") |> drop(fn: (column) => column == "_start" or column == "_stop")`
  
  //   console.log('calculate stakes flux query', fluxQuery)
  
  //   const fluxObserver = {
  //     next(row, tableMeta) {

  //       const o = tableMeta.toObject(row)
  //       let validators = o.validators.trim().split(" ")
  //       let stakes = o.stakes.trim().split(" ")
  //       let recent_votes = o.recent_votes.trim().split(" ")
  //       let vote_histories = o.vote_histories.trim().split(" ")
        

  //       console.log('o', o, validators)
  //       console.log('stakes', stakes)
  //       console.log('recent_votes', recent_votes)
  //       console.log('vote_histories', vote_histories)

  //       recent_votes.forEach((vote,idx) => {
  //         let foundtips = findTips(vote, descendants, parents, Object.keys(tips))
  //         foundtips.forEach(ele => {
  //           tips[ele] += parseInt(stakes[idx])
  //         })
          
  //       })
  //     },
  //     error(error) {
  //       console.log('Finished ERROR', error)
  //     },
  //     complete() {
  //       console.log('Finished SUCCESS', nodeInfoObj)
  //       console.log('tipsobj', tips)
  //       console.log('nodeInfoObj',  nodeInfoObj)
  //       Object.keys(tips).forEach(slot => {
  //         nodeInfoObj[slot].stake = tips[slot]
  //       })
  //       setNodeInfo(nodeInfoObj)
  //     }
  //   }
  
  //   queryApi.queryRows(fluxQuery, fluxObserver)


  // }


  return (
    <div className="App">
      <header className="App-header">
        <div id="parent_cy" style={{display:'flex', flexDirection:'column', justifyContent:'flex-start', alignItems:'center', marginTop:'0px'}}>
          <div style={{display:'flex', flexDirection:'row', width:'97%', justifyContent:'space-between', alignItems:'center', marginBottom:'5px'}}>
            <div style={{display:'flex', flexDirection:'row', justifyContent:'center', alignItems:'center'}}>
              <DateTimePicker 
                onChange={(date) => {
                  let now_utc =  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
                  date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds())
                  setStartDate(new Date(now_utc))
                }}
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
                className="date-picker"
              />
              <Button colorScheme='whiteAlpha' style={{width:'200px', height:'30px', fontSize:'14px',}} onClick={() => {let time = getUnixTime(); getAnalytics(false, currentValidator, time)}}>Get Analytics</Button>
            </div>
            <div style={{display:'flex', flexDirection:'row', justifyContent:'center', alignItems:'center'}}>
              {measurements.length !== 0 && 
                (<div style={{width:"500px"}}><Select variant="unstyled" style={{margin: '0px', justifyContent:'center', color:'white', fontWeight:'normal'}} onChange={(e) => {setSelectedVoteViewValidator(e.target.value);}}>
                  {renderOptions()}
              </Select></div>)}
            {/* <Button colorScheme='whiteAlpha' style={{width:'175px', height:'30px', fontSize:'14px',}} onClick={manualCalculateStakes}>Calculate Stakes</Button> */}
            <Button colorScheme='whiteAlpha' style={{width:'200px', height:'30px', fontSize:'14px',}} onClick={() => setShowVoteHistoryModal(true)}>Validator Voting History</Button>
            <Button colorScheme='whiteAlpha' style={{width:'70px', height:'30px', fontSize:'14px',}} onClick={replayEvents}><VscDebugStart/></Button>
            <Button colorScheme='whiteAlpha' style={{width:'70px', height:'30px', fontSize:'14px',}} onClick={pauseReplay}><VscDebugPause/></Button>
            </div>
          </div>
          {graphState.graph.nodes.length !== 0 && <div id="cy" style={{height:'100%', width:'100%', backgroundColor:'white', display:'flex', flexDirection:'column'}}>
            {showVoteHistoryModal && 
              <Draggable>
                <div style={{backgroundColor:'rgb(0,0,0,0.07)', height:'600px', width:'400px', color:'black', fontSize:'15px', borderRadius:'50px', padding:'15px'}} className="modal">
                  <div style={{display:'flex', flexDirection:'row', width:'90%'}}>
                  <CloseButton onClick={() => {setShowVoteHistoryModal(false)}}></CloseButton>
                  <div style={{width:'90%'}}>Validator {currentValidator} Voting History</div>
                  </div>
                  {renderVoteHistory()}
                </div>
              </Draggable>}

            {currentGraphTime && <div style={{height:'35px', width:'1000px', color:'black', fontSize:'15px', borderRadius:'50px', padding:'5px', alignSelf:'center', flexDirection:'row', backgroundColor:'white'}} className="modal2">
                  <div>Graph Time: {currentGraphTime}  Validator {currentValidator} View</div>
                </div>}
            {showNodeSelectorModal && 
              <Draggable>
                <div style={{backgroundColor:'rgb(0,0,0,0.07)', height:'130px', width:'500px', color:'black', fontSize:'15px', borderRadius:'50px', padding:'15px', alignSelf:'flex-end'}} className="modal">
                  <div style={{display:'flex', flexDirection:'row', width:'90%'}}>
                    <CloseButton onClick={() => {setShowNodeSelectorModal(false)}}></CloseButton>
                    <div style={{display:'flex', flexDirection:'column'}}>
                      {renderNodeInfo()}
                    </div>
                  </div>
                </div>
              </Draggable>}
              
            <Graph getNetwork={(network)=>{setNetwork(network); console.log('setting network')}} graph={graph} options={graph_options} events={events} style={{ height: "100%" }} />
          </div>}
        </div>

      </header>
    </div>
  );
}

export default App;
