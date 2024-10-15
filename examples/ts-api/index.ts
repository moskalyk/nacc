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
class RelaySystem extends EventEmitter {
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
        const relaySystem = new RelaySystem();

        const ModuleContract1: any = {
            mint: (to: string, amount: number) => {
                return `minting to ${to} ${amount}`;
            }
        };

        const digest = computeDigest(ModuleContract1);
        ModuleContract1.digest = digest;

        const chainId = ''; // Polygon's chainId
        const walletAddress = "";
        const message = "";
        const signature = "";

        (await relaySystem.boot({
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