type EventCallback = (data: any, transact?: (payload: any) => void) => void;

class UniqueObjectFilter {
  static cache = new Set();
  static timers = new Map();

  static acceptObject(object: any) {
    // Convert the object to a JSON string for comparison
    const objectKey = JSON.stringify(object);

    // If the object is already in the cache, return null
    if (this.cache.has(objectKey)) {
      return null;
    }

    // Add the new object key to the cache
    this.cache.add(objectKey);

    // Set a timer to remove the object key from the cache after 2 seconds
    const timer = setTimeout(() => {
      this.cache.delete(objectKey);
      this.timers.delete(objectKey);
    }, 1000);

    // Store the timer reference to manage it if needed
    this.timers.set(objectKey, timer);

    // Return the original object since it's unique
    return object;
  }
}

export default class RelaySystem {

    private peerConnections: { [key: string]: RTCPeerConnection } = {};
    private dataChannels: { [key: string]: RTCDataChannel } = {};
    private websocketRef: WebSocket | null = null;
    private eventHandlers: { [key: string]: EventCallback[] } = {};
    private interval: any;

    constructor(private signalingServerUrl: string) {}

    public boot() {
        this.websocketRef = new WebSocket(this.signalingServerUrl);
    
        this.websocketRef.onopen = () => {
          console.log('Connected to signaling server');
        };
    

        this.websocketRef.onmessage = (message: any) => {
            const data = JSON.parse(message.data);
            this.handleSignalingMessage(data);
      
            if(data.peers&&data.peers.length>=2){
              console.log('RELAY_CONNECT')
              this.connectToRelayAndDestination(data.peers.slice(1,data.peers.length),Number(data.message)+1)
            }
        };
    
        this.websocketRef.onclose = () => {
          console.log('Disconnected from signaling server');
        };
    
        this.websocketRef.onerror = (error: any) => {
          console.error('WebSocket error: ', error);
        };
    }

    public on(eventName: string, callback: EventCallback) {
        if (!this.eventHandlers[eventName]) {
          this.eventHandlers[eventName] = [];
        }
        this.eventHandlers[eventName].push(callback);
    }

    public transact(requestArguments: any) {
      var self = this;
      console.log(requestArguments)
      if(requestArguments.via != undefined){
        console.log('gunna forward')
        this.triggerEvent('forward', { message: requestArguments.params, peers: [requestArguments.via,window.location.pathname.substring(1)], seq: 0 }, (payload: any) => {
            self.forwardMessage(payload.peers[0], payload);
        });
      } else {
        console.log('running locally')
      }
    }
 
    private triggerEvent(eventName: string, data: any, transact?: (payload: any) => void) {
        const handlers = this.eventHandlers[eventName] || [];
        handlers.forEach((handler) => handler(data, transact));

        // const wildcardHandlers = this.eventHandlers['*'] || [];
        // wildcardHandlers.forEach((handler) => handler(data, transact));
    }

    private async handleSignalingMessage (message: any) {
        const { from, sdp, candidate } = message;

        if (!this.peerConnections[from]) {
            // Create a new peer connection for the client ID
            const pc = new RTCPeerConnection();
            this.setupPeerConnection(from, pc);
        }

        if (sdp) {
            await this.handleRemoteSDP(from, sdp);
        } else if (candidate) {
            await this.peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
        }
    };

    private async handleRemoteSDP (from: any, sdp: any) {
        const peerConnection = this.peerConnections[from];
        const remoteDesc = new RTCSessionDescription(sdp);
        await peerConnection.setRemoteDescription(remoteDesc);
    
        if (sdp.type === 'offer') {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          this.websocketRef!.send(JSON.stringify({ to: from, sdp: answer }));
        }
    };

    private setupPeerConnection(remoteClientId: any, peerConnection: any) {
        this.peerConnections[remoteClientId] = peerConnection;
        var self  = this;

        // Handle ICE candidates
        peerConnection.onicecandidate = (event: any) => {
          if (event.candidate) {
            self.websocketRef!.send(JSON.stringify({
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
            let { message, peers, origin, seq } = JSON.parse(e.data);

            console.log('origin', origin)
            console.log('Received:', message, 'for peers', peers);

            let interval = setTimeout(() => {
              // if (!self.hasMessageBeenProcessed(origin, message)) {
                  // self.markMessageAsProcessed(origin, message);
                  // message += 1;  // Increment the message

                  if (peers[seq]) {
                      self.triggerEvent('forward', { message, peers: peers.slice(1,peers.length) }, (payload: any) => {
                          clearInterval(interval);
                          seq=Number(seq)+1
                          self.forwardMessage(peers[seq], payload);
                      });
                  } else {
                    self.triggerEvent('receipt', UniqueObjectFilter.acceptObject({ data: e.data }))
                  }
              // } else {
                  // clearInterval(interval);
                  // console.log("Final destination reached:", message);
              // }
            }, 100);
        }
    }
    
        this.dataChannels[remoteClientId] = peerConnection.createDataChannel('messageChannel');
    
        // Handle the case where we are the initiator
        this.dataChannels[remoteClientId].onopen = () => {
          console.log('Data channel opened for client:', remoteClientId);
        };
    };
    
    public connectToRelayAndDestination (peers: any, counter: number) {
        var self = this
        peers.map(async (peerId: any, index: any) => {
          const peerConnection = new RTCPeerConnection();
          self.setupPeerConnection(peerId, peerConnection);
      
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
      
          self.websocketRef!.send(JSON.stringify({
            to: peerId,
            sdp: offer,
            peers: peers,
            message: counter
          }));
    
          // Send initial message from the origin (index 0)
          if (index === 0) {
            self.dataChannels[peerId].onopen = () => {
                const origin = window.location.pathname.slice(1,window.location.pathname.length);
                self.dataChannels[peerId].send(JSON.stringify({ initiator: true, origin: origin, message: counter, peers: peers }));
            };
          }
        });
    };

    public async forwardMessage(nextPeerId: any, data: any) {
        // Forward the message to the next client in the chain
        console.log(`Forwarding message: ${JSON.stringify(data)} to peer ${nextPeerId}`);
        const res = UniqueObjectFilter.acceptObject(data)
        if(res){
          this.dataChannels[nextPeerId].send(JSON.stringify(res));
        } 
    };
}