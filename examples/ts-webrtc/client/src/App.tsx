import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import RelaySystem from '../../api'

const websocketUrl = `ws://localhost:8079/?sigil=${window.location.pathname.substring(1)}`;
const rs = new RelaySystem(websocketUrl)

const WebRTCComponent = () => {
  useEffect(() => {
    rs.boot()
    rs.on('forward', (data: any, forward1: any) => {
      console.log('its forwarding!')
      console.log(data)
      data.message+=1
      console.log(forward1)
      forward1(data);
    })
    return () => {}
  }, [])

  return (
    <div>
      <h1>WebRTC Relay Example</h1>
      <button onClick={() => {
        const clientIds = prompt('Enter relay and destination ID (comma-separated)')!.split(',');
        const counter = 0;  // Example array of messages
        if(clientIds.length > 3){
          alert('only single-hops to destination implemented')
        }else {
          rs.connectToRelayAndDestination(clientIds, counter);  // Pass relay and destination IDs and initial message
        }
      }}>
        Connect to Relay and Destination
      </button>
    </div>
  );
};

function App() {
  return (
    <>
      <WebRTCComponent/>
    </>
  );
}

export default App;