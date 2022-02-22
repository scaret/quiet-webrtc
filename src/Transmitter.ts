import {QuietProfile, TransmitterOptions} from "./interfaces";
import {Module} from "./Module";
import {Quiet} from "./Quiet";
import {str2ab} from "./util";
import { EventEmitter } from "eventemitter3";

export class Transmitter extends EventEmitter{
    profileObj: QuietProfile
    done: ()=>void
    clampFrame: boolean

    opt: string;

    c_profiles: number[];
    c_profile: number[];
    private encoder: any;
    private quiet: Quiet;

    running: boolean = false

    inited: boolean = true

    private sample_view: Float32Array;
    private samplesToPlay:Float32Array[] = [];
    private emptySample: Float32Array;

    private payload: ArrayBuffer[] = [];
    private opts: TransmitterOptions;
    private samples: number = 0;
    private last_emit_times: number[] = [];
    private num_emit_times: number = 3;
    private empties_written: number = 0;
    private scriptNode: ScriptProcessorNode;
    private mediaStreamDestination: MediaStreamAudioDestinationNode;
    private dummy_osc: OscillatorNode;
    private frame_len: number;
    private stream: MediaStream;
    //表示scriptNode是否在播放。
    private playing = false;
    private paused = false;

    constructor(opts: TransmitterOptions) {
        super()
        this.opts = opts
        this.profileObj = opts.profile
        this.quiet = opts.quiet
        this.clampFrame = opts.clampFrame

        this.c_profiles = Module.intArrayFromString(JSON.stringify({"profile": this.profileObj}));
        this.c_profile = Module.intArrayFromString("profile");

        this.done = opts.onFinish

        this.opt = Module.ccall('quiet_encoder_profile_str', 'pointer', ['array', 'array'], [this.c_profiles, this.c_profile]);

        // libquiet internally works at 44.1kHz but the local sound card
        // may be a different rate. we inform quiet about that here
        this.encoder = Module.ccall('quiet_encoder_create', 'pointer', ['pointer', 'number'], [this.opt, this.quiet.audioCtx.sampleRate]);

        Module.ccall('free', null, ['pointer'], [this.opt]);

        this.frame_len = 0;
        if (this.clampFrame) {
            // enable close_frame which prevents data frames from overlapping multiple
            // sample buffers. this is very convenient if our system is not fast enough
            // to feed the sound card without any gaps between subsequent buffers due
            // to e.g. gc pause. inform quiet about our sample buffer size here
            this.frame_len = Module.ccall('quiet_encoder_clamp_frame_len', 'number', ['pointer', 'number'], [this.encoder, this.quiet.sampleBufferSize]);
        } else {
            this.frame_len = Module.ccall('quiet_encoder_get_frame_len', 'number', ['pointer'], [this.encoder]);
        }
        this.samples = Module.ccall('malloc', 'pointer', ['number'], [4 * this.quiet.sampleBufferSize]);

        // yes, this is pointer arithmetic, in javascript :)
        this.sample_view = Module.HEAPF32.subarray((this.samples/4), (this.samples/4) + this.quiet.sampleBufferSize);
        this.emptySample = new Float32Array(this.sample_view.length)

        //搬运自startTransmitter
        const onaudioprocess = (e:AudioProcessingEvent) => {
            const output_l = e.outputBuffer.getChannelData(0);
            if (this.paused){
                output_l.set(this.emptySample)
            }else{
                const sample = this.samplesToPlay.shift();
                if (sample){
                    if (!this.playing){
                        this.emit('play-started')
                        this.playing = true
                    }
                    output_l.set(sample)
                }else{
                    if (this.playing){
                        this.emit('play-stopped')
                        this.playing = false
                    }
                    output_l.set(this.emptySample)
                }
            }
        }

        // we want a single input because some implementations will not run a node without some kind of source
        // we want two outputs so that we can explicitly silence the right channel and no mixing will occur
        this.scriptNode = this.quiet.audioCtx.createScriptProcessor(this.quiet.sampleBufferSize, 1, 2)
        this.scriptNode.onaudioprocess = onaudioprocess;
        // put an input node on the graph. some browsers require this to run our script processor
        // this oscillator will not actually be used in any way
        this.dummy_osc = this.quiet.audioCtx.createOscillator();
        this.dummy_osc.type = 'square';
        this.dummy_osc.frequency.value = 420;
        this.mediaStreamDestination = this.quiet.audioCtx.createMediaStreamDestination()
        this.stream = this.mediaStreamDestination.stream
    }

    pause(){
        //只pause完整的消息
        this.paused = true
    }

    resume(){
        this.paused = false
    }

    // 都是阻塞性同步方法，貌似没必要做async
    async transmit(buf: ArrayBuffer){
        //发送完后返回
        if (!this.inited) {
            return;
        }
        if (!buf.byteLength){
            console.error("empty message")
            return;
        }
        while(true){
            if (!this.paused && this.playing){
                // 多次transmit混在一起则等待50毫秒
                await new Promise((resolve)=>{
                    setTimeout(resolve, 50);
                })
            }else{
                break;
            }
        }
        // slice up into frames and push the frames to a list
        for (let i = 0; i < buf.byteLength; ) {
            const frame = buf.slice(i, i + this.frame_len);
            i += frame.byteLength;
            this.payload.push(frame);
        }
        // now do an update. this may or may not write samples
        this.writebuf();
        this.readBuf();
    }

    transmitText(text: string){
        const ab = str2ab(text)
        return this.transmit(ab)
    }

    startTransmitter(){
        if (!this.inited) {
            return;
        }
        this.inited = true

        this.dummy_osc.connect(this.scriptNode);
        this.scriptNode.connect(this.mediaStreamDestination);
        this.running = true;
    }

    writebuf() {
        if (!this.inited) {
            return;
        }
        // fill as much of quiet's transmit queue as possible
        let frame_available = false;
        let frame_written = false;
        let counts = {
            send: 0,
            emit: 0,
        }
        while(true) {
            const frame = this.payload.shift();
            if (!frame) {
                break;
            }
            frame_available = true;
            const written = Module.ccall('quiet_encoder_send', 'number', ['pointer', 'array', 'number'], [this.encoder, new Uint8Array(frame), frame.byteLength]);
            if (written === -1) {
                this.payload.unshift(frame);
                break;
            }else{
                counts.send++
            }
            frame_written = true;
        }
        // if (counts.send){
        //     console.error(`编码请求${counts.send}帧`)
        // }

        if (!this.payload.length && frame_written) {
            // we wrote at least one frame and emptied out payload, our local (js) tx queue
            // this means we have transitioned to having all data in libquiet
            // notify user about this if they like
            // this is an important transition point because it allows user to control
            // memory util without sacrificing throughput as would be the case for waiting
            // for onFinish, which is only called after everything has flushed
            if (this.opts.onEnqueue !== undefined) {
                try{
                    this.opts.onEnqueue();
                }catch(e){
                    console.error(e)
                }
            }
        }

        if (frame_available && !this.running) {
            this.startTransmitter();
        }
    }

    readBuf(){
        // now set the sample block

        while(true){
            const before = Date.now();
            const written = Module.ccall('quiet_encoder_emit', 'number', ['pointer', 'pointer', 'number'], [this.encoder, this.samples, this.quiet.sampleBufferSize]);
            const after = Date.now();
            // if (written !== -1){
            //     console.error("编码返回1帧")
            // }

            this.last_emit_times.unshift(after - before);
            if (this.last_emit_times.length > this.num_emit_times) {
                this.last_emit_times.pop();
            }

            // libquiet notifies us that the payload is finished by
            // returning written < number of samples we asked for
            if (written === -1) {
                if (this.empties_written < 1) {
                    // 没读到数据，但仍坚持播放3帧静音
                    // flush out browser's sound sample buffer before quitting
                    this.samplesToPlay.push(this.emptySample)
                    this.empties_written++;
                }else{
                    // looks like we are done
                    // user callback
                    if (this.done !== undefined) {
                        this.done();
                    }
                    if (this.running) {
                        this.stopTransmitter();
                    }
                    break;
                }
            }else{
                this.empties_written = 0;

                const samples = new Float32Array(this.sample_view)
                // in this case, we are sending data, but the whole block isn't full (we're near the end)
                if (written < this.quiet.sampleBufferSize) {
                    // be extra cautious and 0-fill what's left
                    //   (we want the end of transmission to be silence, not potentially loud noise)
                    for (let i = written; i < this.quiet.sampleBufferSize; i++) {
                        samples[i] = 0;
                    }
                }
                this.samplesToPlay.push(samples)
            }
        }
    }

    stopTransmitter() {
        if (!this.inited) {
            return;
        }
        // this.dummy_osc.disconnect(this.scriptNode);
        // this.scriptNode.disconnect(this.mediaStreamDestination);
        this.running = false;
    }
}
