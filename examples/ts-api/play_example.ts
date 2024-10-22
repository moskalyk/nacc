class Relay {
    constructor(wsURL: string){
        console.log(wsURL)
    }
    async via(nodes: any | Array<string>): Promise<NetBundle> {
        return nodes
    }
    gossip() {
        setInterval(() => {
            console.log('polling')
        }, 2000)
        return this;
    }
    async on(event: any | Array<string>, obj: Payload | Read) {
        if(Object.getPrototypeOf(obj) == Read.prototype){
            return obj
        } else {
            switch(event){
                case 'morgan':
                    // @ts-ignore
                    return obj.payload.toUpperCase()
                break
                default:
                    // @ts-ignore
                return obj.payload.toUpperCase()
            }
        }
    }
}

class Payload { 
    payload;
    constructor(payload: any) {
        this.payload = payload
    }
}

class Read{
    cid
    constructor(cid: any){
        this.cid = cid
    }
}

class NetBundle {}

const relay = new Relay('ws://localhost:8079').gossip();

(async () => {
    const res = await relay.on('morgan', new Payload('hello'))
    console.log(res)

    const relayBundle: NetBundle = await relay.via(['william', 'moskalyk'])
    console.log(relayBundle)

    const resPayload2 = await relay.on(relayBundle, new Payload('hi'))
    console.log(resPayload2)

    const res2 = await relay.on('morgan', new Read('bafy'))
    const res3 = await relay.on(['morgan','william','moskalyk'], new Read('bafy'))
    console.log(res2)
    console.log(res3)
})()