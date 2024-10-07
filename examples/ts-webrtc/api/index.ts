type EventCallback = (data: any, transact?: (payload: any) => void) => void;

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
            console.log(data)
            this.handleSignalingMessage(data);
      
            if(data.peers&&data.peers.length>=2){
              this.connectToRelayAndDestination(data.peers.slice(1,data.peers.length),Number(data.message)+1)
            }
        };

        // this.websocketRef.onmessage = (message: any) => {
        //   const data = JSON.parse(message.data);
        //   console.log('WebSocket received:', data);
        //   this.handleSignalingMessage(data);
        // };
    
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

    // Helper methods to track message processing status
    private processedMessages: Set<string> = new Set();

    private hasMessageBeenProcessed(origin: string, message: number): boolean {
        return this.processedMessages.has(`${origin}-${message}`);
    }

    private markMessageAsProcessed(origin: string, message: number): void {
        this.processedMessages.add(`${origin}-${message}`);
    }

    private setupPeerConnection(remoteClientId: any, peerConnection: any) {
        this.peerConnections[remoteClientId] = peerConnection;
        // this.setPeerConnections=...this.peerConnections
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
            let { initiator, message, peers, origin } = JSON.parse(e.data);

            // if(!initiator){

            console.log('origin', origin)
            // console.log()
            console.log('Received:', message, 'for peers', peers);

            // if(message < peers.length) {
                let interval = setTimeout(() => {
            //         console.log('RUNNING')
            //         console.log('Received:', message, 'for peers', peers, 'origin', origin);
            if (!self.hasMessageBeenProcessed(origin, message)) {
                self.markMessageAsProcessed(origin, message);
            message += 1;  // Increment the message

                    if (peers[message]) {
            //             // Safeguard to ensure forwarding only happens once
                        

                            self.triggerEvent('forward', { message, peers: peers.slice(1,peers.length) }, (payload: any) => {
                                clearInterval(interval);
                                self.forwardMessage(peers[message], payload);
                            });
                        }
                    } else {
                        clearInterval(interval);
                        console.log("Final destination reached:", message);
                    }
                }, 100);
            // }
        }
    }
    
        this.dataChannels[remoteClientId] = peerConnection.createDataChannel('messageChannel');
        // setDataChannels({ ...dataChannels });
    
        // Handle the case where we are the initiator
        this.dataChannels[remoteClientId].onopen = () => {
          console.log('Data channel opened for client:', remoteClientId);
        };
    };
    
    public connectToRelayAndDestination (peers: any, counter: number) {
        var self = this
        peers.map(async (peerId: any, index: any) => {
          console.log('setting up relay')
          console.log(peers)
          console.log(counter)
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
                // const origin = Date.now()
                // console.log(origin)
                const origin = window.location.pathname.slice(1,window.location.pathname.length);

                // Log the path to the console
                console.log(origin);
                console.log(peerId)
                // const message = counter;
                self.dataChannels[peerId].send(JSON.stringify({ initiator: true, origin: origin, message: counter, peers: peers }));
                // self.triggerEvent('forward', { message, peers: peers }, (payload: any) => {
                //     self.forwardMessage(peerId, payload);
                // });
            };
          }
        });
    };

    public async forwardMessage(nextPeerId: any, data: any) {
        console.log(`Forwarding message: ${JSON.stringify(data)} to peer ${nextPeerId}`);
        // Forward the message to the next client in the chain
        this.dataChannels[nextPeerId].send(JSON.stringify(data));
    };
}