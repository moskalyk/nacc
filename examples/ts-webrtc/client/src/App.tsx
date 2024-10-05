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

    websocketRef.current.onmessage = (message: any) => {
      const data = JSON.parse(message.data);
      handleSignalingMessage(data);
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

  // Handle signaling messages from the WebSocket server
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

  // Setup a peer connection and create data channels
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

    // Handle remote peer's data channel (receiver side)
    peerConnection.ondatachannel = (event: any) => {
      const receivedChannel = event.channel;
      console.log('Data channel opened on receiver side for client:', remoteClientId);

      receivedChannel.onmessage = (e: any) => {
        const { messages, relayIndex, peers } = JSON.parse(e.data);
        console.log('Received:', messages, 'at relay index:', relayIndex);

        // Check if there's a next relay or if it's the final destination
        const nextRelayIndex = relayIndex + 1;
        if (nextRelayIndex < peers.length) {
          messages[nextRelayIndex] += 1;  // Increment the message
          forwardMessage(peers[nextRelayIndex], { messages, relayIndex: nextRelayIndex, peers: peers });
        } else {
          console.log("Final destination reached:", messages);
        }
      };
    };

    dataChannels[remoteClientId] = peerConnection.createDataChannel('messageChannel');
    setDataChannels({ ...dataChannels });

    // Handle the case where we are the initiator
    dataChannels[remoteClientId].onopen = () => {
      console.log('Data channel opened for client:', remoteClientId);
    };
  };

  // Handle remote SDP (Offer/Answer)
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

  // Create new connections to the relay and destination
  const connectToRelayAndDestination = async (peers: any, initialMessages: number[]) => {
    peers.map(async (peerId: any, index: any) => {
      const peerConnection = new RTCPeerConnection();
      setupPeerConnection(peerId, peerConnection);
  
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
  
      websocketRef.current.send(JSON.stringify({
        to: peerId,
        sdp: offer
      }));

      // Send initial message from the origin (index 0)
      if (index === 0) {
        dataChannels[peerId].onopen = () => {
          const initialRelayIndex = 0;  // Start from the first relay
          dataChannels[peerId].send(JSON.stringify({ messages: initialMessages, relayIndex: initialRelayIndex, peers: peers }));
        };
      }
    });
  };

  // Forward messages hop-to-hop: Origin -> Relay -> Destination
  const forwardMessage = (nextPeerId: any, data: any) => {
    console.log(`Forwarding message: ${data.messages} to peer ${nextPeerId} at relay index ${data.relayIndex}`);

    // Forward the message to the next client in the chain
    dataChannels[nextPeerId].send(JSON.stringify(data));
  };

  return (
    <div>
      <h1>WebRTC Relay Example</h1>
      <button onClick={() => {
        const clientIds = prompt('Enter relay and destination IDs (comma-separated)')!.split(',');
        const initialMessages = [0, 0, 0];  // Example array of messages
        connectToRelayAndDestination(clientIds, initialMessages);  // Pass relay and destination IDs and initial message
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
