# p2p cycles
playing on the idea of timers in a distributed system, this concept of a cycle explores the idea of time, like a clock, that creates cyclical messages to a peer, based on a resilient p2p backend discovery mesh

## flow 
where the flow looks like the following sequence:

1. peer A registers timer cycle to peer B
2. peer B registers to peer C
3. peer B sends a message on time to peer A
4. peer B sends a message to peer C at a interval that can create a new connection to another peer, which is less than the original time interval
5. if peer A is still up and peer B drops, peer C sends message to peer A on cadence, performs a gossip discovery, and performs a handshake to peer D as a continually resilient up-time. the cycle continues of step 3 and 4.

[inspiration](https://fluence.dev/docs/build/how-to/schedule_functions#spell-basics)