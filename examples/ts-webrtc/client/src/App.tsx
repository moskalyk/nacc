import './App.css';
import React, { useEffect, useRef, useState } from 'react';
import RelaySystem from '../../api'

const websocketUrl = `ws://localhost:8079/?sigil=${window.location.pathname.substring(1)}`;
const rs = new RelaySystem(websocketUrl)

const WebRTCComponent = () => {
  const [clientIDs, setClientIDs] = useState<any>([])

  useEffect(() => {
    rs.boot()

    rs.on('forward', (data: any, forward: any) => {
      console.log('its forwarding!')
      console.log(data)
      data.message= Number(data.message)+1
      forward(data);
    })

    rs.on('receipt', (payload: string) => {
      // recieving end 
      console.log(payload)
    })

    return () => {}
  }, [])

  const callTransaction = () => {
    rs.transact({
        call: 'mint',  // Pass the method name as a string
        // digest: digest, // Use the computed digest
        via: clientIDs[0], // Handle `via` logic as per your requirements
        params: [window.location.pathname.substring(1), 0] // Parameters to be passed to the method
    })
  }

  return (
    <div>
      <h1>WebRTC Relay Example</h1>
      <button onClick={() => {
        const clientIds = prompt('Enter relay and destination ID (comma-separated)')!.split(',');
        const counter = 0;  // Example array of messages
        if(clientIds.length > 3){
          alert('only single-hops to destination implemented')
        }else {
          setClientIDs(clientIds)
          rs.connectToRelayAndDestination(clientIds, counter);  // Pass relay and destination IDs and initial message
        }
      }}>
        Connect to Relay and Destination
      </button>
      <br/>
      <br/>
      <button onClick={() => {
        callTransaction()
      }}>transact</button>
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