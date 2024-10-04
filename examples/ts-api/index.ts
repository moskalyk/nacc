import crypto from 'crypto';
import { EventEmitter } from 'events';
import { sequence } from '0xsequence';

interface BootOptions {
    walletAddress: string;
    message: string;
    signature: string;
    chainId: string; 
}

// must be wasm
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

    load(modules: any) {
        this.modules.push(...modules)
        return this
    }

    listen() {
        const self = this;
        setInterval(() => {
            this.emit('*', { blockNumber: ++this.block }, async (transact: any) => {
                console.log('sending a block');
                // Extract the call, digest, via, and params from transact
                const { call, digest, params } = transact;
                if (typeof call === 'string' && this.modules[0] && typeof this.modules[0][call] === 'function') {
                    const result = await this.modules[0][call](...params);
                    self.emit('record', result);
                } else {
                    console.error('Invalid call or method not found on module');
                }
            });
        }, 2000);

        setInterval(() => {
            this.emit('forward', { can: true }, {
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

// Function to compute digest of a Module Contract
function computeDigest(moduleObject: any): string {
    const moduleString = JSON.stringify(moduleObject); // Convert the object to a JSON string
    const hash = crypto.createHash('sha512'); // Create a SHA-512 hash
    hash.update(moduleString); // Update the hash with the module string
    return hash.digest('hex'); // Return the hash as a hex string
}

(async () => {
    try {
        const mutual = new Mutual();

        const ModuleContract1: any = {
            mint: (to: string, amount: number) => {
                return `minting to ${to} ${amount}`;
            }
        };

        const digest = computeDigest(ModuleContract1);
        ModuleContract1.digest = digest;

        const chainId = 'polygon'; // Polygon's chainId
        const walletAddress = "0x2fa0b551fdFa31a4471c1C52206fdb448ad997d1";
        const message = "Hi, please sign this message";
        const signature = "0x000501032a44625bec3b842df681db00a92a74dda5e42bcf0203596af90cecdbf9a768886e771178fd5561dd27ab005d0001000183d971056b1eca1bcc7289b9a6926677c5b07db4197925346367f61f2d09c732760719a91722acee0b24826f412cb69bd2125e48f231705a5be33d1f5523f9291c020101c50adeadb7fe15bee45dcb820610cdedcd314eb0030002f19915df00d669708608502d3011a09948b32674d6e443202a2ba884a4dcd26c2624ff33a8ee9836cc3ca2fbb8d3aa43382047b73d21646cb66cc2916076c1331c02";

        (await mutual.boot({
                signature: signature,
                walletAddress: walletAddress,
                message: message,
                chainId: chainId
            }))
            .load([ModuleContract1])
            .on('*', (block, transact) => {
                block.blockNumber === 4 ?
                    transact({
                        call: 'mint',  // Pass the method name as a string
                        digest: digest, // Use the computed digest
                        via: [], // Handle `via` logic as per your requirements
                        params: ['~milbyt-moszod', 1] // Parameters to be passed to the method
                    })
                :
                    console.log(block)
            })
            .on('forward', (request, forward) => forward.a(request, forward.to))
            .on('verify', (request) => true)
            .on('record', (record) => console.log(record))
            .listen();
    } catch (error) {
        console.error('Error during boot:', error);
    }
})()