import { sequence } from '0xsequence';
import { EventEmitter } from 'events';

interface BootOptions {
    walletAddress: string;
    message: string;
    signature: string;
    chainId: string; // Change chainId to number
}

class Mutual extends EventEmitter {
    modules: Array<any>;
    block: number;

    constructor() {
        super();
        this.modules = [];
        this.block = 0;
    }

    boot(options: BootOptions) {
        const api = new sequence.api.SequenceAPIClient("https://api.sequence.app");

        return api.isValidMessageSignature(options).then((result) => {
            console.log('Signature valid:', result.isValid);
        
            if (result.isValid) {
                return this;
            } else {
                throw new Error('Invalid signature');
            }
        });
    }

    on(eventName: string, listener: (...args: any[]) => void) {
        super.on(eventName, listener);
        return this;
    }

    listen() {
        const self = this;
        setInterval(() => {
            this.emit('*', { blockNumber: ++this.block }, async (transact: any) => { // dx receiver
                console.log('sending a block');
                const result = await transact.call(...transact.params);
                self.emit('record', result);
            });
        }, 2000);

        setInterval(() => {
            this.emit('forward', { canU: true }, { 
                a: (request: any) => {
                    console.log('Forwarding request:', request);
                    this.emit('record', 'This is a record example');
                }, 
                to: 'aw' 
            });
        }, 10000);

        return this;
    }
}

(async () => {
    try {
        const mutual = new Mutual();
        const ModuleContract1 = { // to be c
            mint: (to: string, amount: number) => { 
                return `minting to ${to} ${amount}`
            }
        };
        
        const chainId = 'polygon'; // Polygon's chainId is 137
        const walletAddress = "0x2fa0b551fdFa31a4471c1C52206fdb448ad997d1";
        const message = "Hi, please sign this message";
        const signature =
        "0x000501032a44625bec3b842df681db00a92a74dda5e42bcf0203596af90cecdbf9a768886e771178fd5561dd27ab005d0001000183d971056b1eca1bcc7289b9a6926677c5b07db4197925346367f61f2d09c732760719a91722acee0b24826f412cb69bd2125e48f231705a5be33d1f5523f9291c020101c50adeadb7fe15bee45dcb820610cdedcd314eb0030002f19915df00d669708608502d3011a09948b32674d6e443202a2ba884a4dcd26c2624ff33a8ee9836cc3ca2fbb8d3aa43382047b73d21646cb66cc2916076c1331c02";
        
        (await mutual.boot({
                signature: signature,          
                walletAddress: walletAddress,      
                message: message,             
                chainId: chainId         
            }))
            .on('*', (block, transact) => {
                if (block.blockNumber == 4) {
                    transact({
                        call: ModuleContract1.mint,
                        via: [], // todo
                        params: ['~milbyt-moszod', 1]
                    });
                } else {
                    console.log(block);
                }
            })
            .on('forward', (request, forward) => forward.a(request, forward.to))
            .on('record', (record) => console.log(record))
            .listen();
    } catch (error) {
        console.error('Error during boot:', error);
    }
})()