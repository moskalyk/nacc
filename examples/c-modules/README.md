# c-modules
c module that transforms data sent from websocket server

1. compile c code
note: must have emcc installed 

```
./compile.sh
```

2. run a python server for frontend
```
python3 -m http.server 8000
```

3. open web browser

## nice to have
- create react based project
- convert websocket to webrtc with c module communication
- create static function transforms with return data versus in-memory 2-call data