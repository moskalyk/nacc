import { useState, useEffect } from 'react'
import './App.css'
import RelaySystem from './api'

const websocketUrl = `ws://localhost:8079/?sigil=${window.location.pathname.substring(1)}`;
const rs = new RelaySystem(websocketUrl)

function App() {

  useEffect(() => {
    rs.boot()

    rs.on('cycle', (data: any, cycle: any) => {
      console.log('its a cycle')
      console.log(data)
      console.log(cycle)
      // setInterval(() => {
      //   console.log('running a cycle')
      // }, 1000)
    })

    rs.on('forward', (data: any, forward1: any) => {
      console.log('its forwarding!')
      console.log(data)
      data.message+=1
      console.log(forward1)
      forward1(data);
    })
    return () => {}
  }, [])

  const connect = () => {
    const clientIds = prompt('Enter relay and destination ID (comma-separated)')!.split(',');
    const counter = 0;
    if(clientIds.length > 3){
      alert('only single-hops to destination implemented')
    }else {
      rs.connectToRelayAndDestination(clientIds, counter);
      setTimeout(() => {
        rs.registerCycle(clientIds)
      }, 2000)
    }
  }

  const initMessages = () => {
    console.log('init')
  }

  const disconnect = () => {
    console.log('disconnect')
  }
  
  return (
    <>
      <button onClick={() => connect()}>connect</button>
      <button onClick={() => initMessages()}>init messages</button>
      <button onClick={() => disconnect()}>disconnect</button>
    </>
  )
}

export default App
