import './App.css';
import React, { useEffect, useRef, useState } from 'react';

const WebRTCComponent = () => {
  const [peerConnections, setPeerConnections] = useState<any>({});
  const [dataChannels, setDataChannels] = useState<any>({});
  const websocketRef = useRef<any>(null);

  // Initialize WebSocket connection and handle signaling
  useEffect(() => {
    websocketRef.current = new WebSocket('ws://localhost:8079');
    
    websocketRef.current.onopen = () => {
      console.log('Connected to signaling server');
    };

    // 3.
    websocketRef.current.onmessage = (message: any) => {
      const data = JSON.parse(message.data);
      console.log(data)
      handleSignalingMessage(data);

      if(data.peers&&data.peers.length>=2){
        connectToRelayAndDestination(data.peers.slice(1,data.peers.length),Number(data.message)+1)
      }
    };

    websocketRef.current.onclose = () => {
      console.log('Disconnected from signaling server');
    };

    websocketRef.current.onerror = (error: any) => {
      console.error('WebSocket error: ', error);
    };

    return () => {
      websocketRef.current.close();
    };
  }, []);

  // 4. Handle signaling messages from the WebSocket server
  const handleSignalingMessage = async (message: any) => {
    const { from, sdp, candidate } = message;

    if (!peerConnections[Number(from)]) {
      // Create a new peer connection for the client ID
      const pc = new RTCPeerConnection();
      setupPeerConnection(from, pc);
    }

    if (sdp) {
      await handleRemoteSDP(from, sdp);
    } else if (candidate) {
      await peerConnections[Number(from)].addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  // 2. Setup a peer connection and create data channels
  const setupPeerConnection = (remoteClientId: any, peerConnection: any) => {
    peerConnections[Number(remoteClientId)] = peerConnection;
    setPeerConnections({ ...peerConnections });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        websocketRef.current.send(JSON.stringify({
          to: remoteClientId,
          candidate: event.candidate
        }));
      }
    };

    let openedPeers: any = {}
    // Handle remote peer's data channel (receiver side)
    peerConnection.ondatachannel = (event: any) => {
      const receivedChannel = event.channel;
      console.log('Data channel opened on receiver side for client:', remoteClientId);
      openedPeers[remoteClientId] = true
      receivedChannel.onmessage = (e: any) => {
        let { message, peers } = JSON.parse(e.data);
        console.log('Received:', message, 'for peers', peers);

        // Check if there's a next relay or if it's the final destination
        if (Number(message) < peers.length ) {
          message += 1;  // Increment the message
          if(openedPeers[peers[message]]) forwardMessage(peers[message], { message, peers: peers });
        } else {
          console.log("Final destination reached:", message);
        }
      };
    };

    dataChannels[Number(remoteClientId)] = peerConnection.createDataChannel('messageChannel');
    setDataChannels({ ...dataChannels });

    // Handle the case where we are the initiator
    dataChannels[Number(remoteClientId)].onopen = () => {
      console.log('Data channel opened for client:', remoteClientId);
    };
  };

  // 5. Handle remote SDP (Offer/Answer)
  const handleRemoteSDP = async (from: any, sdp: any) => {
    const peerConnection = peerConnections[Number(from)];
    const remoteDesc = new RTCSessionDescription(sdp);
    await peerConnection.setRemoteDescription(remoteDesc);

    if (sdp.type === 'offer') {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      websocketRef.current.send(JSON.stringify({ to: from, sdp: answer }));
    }
  };

  // 1. Create new connections to the relay and destination
  const connectToRelayAndDestination = async (peers: any, counter: number) => {
    peers.map(async (peerId: any, index: any) => {
      console.log('setting up relay')
      console.log(peers)
      console.log(counter)
      const peerConnection = new RTCPeerConnection();
      setupPeerConnection(peerId, peerConnection);
  
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
  
      websocketRef.current.send(JSON.stringify({
        to: peerId,
        sdp: offer,
        peers: peers,
        message: counter
      }));

      // Send initial message from the origin (index 0)
      if (index === 0) {
        dataChannels[Number(peerId)].onopen = () => {
          dataChannels[Number(peerId)].send(JSON.stringify({ message: counter, peers: peers }));
        };
      }
    });
  };

  // 6. Forward messages hop-to-hop: Origin -> Relay -> Destination
  const forwardMessage = (nextPeerId: any, data: any) => {
    console.log(`Forwarding message: ${data.message} to peer ${nextPeerId}`);

    // Forward the message to the next client in the chain
    dataChannels[nextPeerId].send(JSON.stringify(data));
  };

  return (
    <div>
      <h1>WebRTC Relay Example</h1>
      <button onClick={() => {
        const clientIds = prompt('Enter relay and destination IDs (comma-separated)')!.split(',');
        const counter = 0;  // Example array of messages
        if(clientIds.length > 3){
          alert('only single-hops to destination implemented')
        }else {
          connectToRelayAndDestination(clientIds, counter);  // Pass relay and destination IDs and initial message
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