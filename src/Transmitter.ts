import {QuietProfile, TransmitterOptions} from "./interfaces";
import {Module} from "./Module";
import {Quiet} from "./Quiet";
import {str2ab} from "./util";

export class Transmitter{
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
    private played: Boolean = true;
    private sample_view: Float32Array;
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

    constructor(opts: TransmitterOptions) {
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

        //搬运自startTransmitter
        const onaudioprocess = (e:AudioProcessingEvent) => {
            const output_l = e.outputBuffer.getChannelData(0);

            if (this.played) {
                // we've already played what's in sample_view, and it hasn't been
                //   rewritten for whatever reason, so just play out silence
                for (let i = 0; i < this.quiet.sampleBufferSize; i++) {
                    output_l[i] = 0;
                }
                return;
            }

            this.played = true;

            output_l.set(this.sample_view);
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

    // 都是阻塞性同步方法，貌似没必要做async
    transmit(buf: ArrayBuffer){
        //发送完后返回
        if (!this.inited) {
            return;
        }
        // slice up into frames and push the frames to a list
        for (let i = 0; i < buf.byteLength; ) {
            const frame = buf.slice(i, i + this.frame_len);
            i += frame.byteLength;
            this.payload.push(frame);
        }
        // now do an update. this may or may not write samples
        this.writebuf();
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
            }
            frame_written = true;
        }

        if (!this.payload.length && frame_written) {
            // we wrote at least one frame and emptied out payload, our local (js) tx queue
            // this means we have transitioned to having all data in libquiet
            // notify user about this if they like
            // this is an important transition point because it allows user to control
            // memory util without sacrificing throughput as would be the case for waiting
            // for onFinish, which is only called after everything has flushed
            if (this.opts.onEnqueue !== undefined) {
                window.setTimeout(this.opts.onEnqueue, 0);
            }
        }

        if (frame_available && !this.running) {
            this.startTransmitter();
        }

        // now set the sample block
        if (!this.played) {
            // the existing sample block has yet to be played
            // we are done
            return;
        }

        const before = Date.now();
        const written = Module.ccall('quiet_encoder_emit', 'number', ['pointer', 'pointer', 'number'], [this.encoder, this.samples, this.quiet.sampleBufferSize]);
        const after = Date.now();

        this.last_emit_times.unshift(after - before);
        if (this.last_emit_times.length > this.num_emit_times) {
            this.last_emit_times.pop();
        }

        // libquiet notifies us that the payload is finished by
        // returning written < number of samples we asked for
        if (!frame_available && written === -1) {
            if (this.empties_written < 3) {
                // flush out browser's sound sample buffer before quitting
                for (let i = 0; i < this.quiet.sampleBufferSize; i++) {
                    this.sample_view[i] = 0;
                }
                this.empties_written++;
                this.played = false;
                return;
            }
            // looks like we are done
            // user callback
            if (this.done !== undefined) {
                this.done();
            }
            if (this.running) {
                this.stopTransmitter();
            }
            return;
        }

        this.played = false;
        this.empties_written = 0;

        // in this case, we are sending data, but the whole block isn't full (we're near the end)
        if (written < this.quiet.sampleBufferSize) {
            // be extra cautious and 0-fill what's left
            //   (we want the end of transmission to be silence, not potentially loud noise)
            for (let i = written; i < this.quiet.sampleBufferSize; i++) {
                this.sample_view[i] = 0;
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
