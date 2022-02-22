import {FrameStats, QuietProfile, ReceiverOptions} from "./interfaces";
import {Quiet} from "./Quiet";
import {Module} from "./Module";

export class Receiver{
    profile: QuietProfile;
    c_profiles: number[];
    c_profile: number[];
    opts: ReceiverOptions;
    opt: ReceiverOptions;

    audioStreams: MediaStream[];
    audioInputs: AudioNode[];
    private quiet: Quiet;
    inited: boolean = false;
    private samples: number = 0;
    private frame: any;
    private lastChecksumFailCount: number = 0;
    private last_consume_times: number[] = [];
    private num_consume_times: number = 0;
    private scriptProcessor: ScriptProcessorNode;
    private sample_view: Float32Array = new Float32Array();
    private audioDestination: MediaStreamAudioDestinationNode;
    private idx: number = 0;
    private decoder: any;

    constructor(opts: ReceiverOptions) {
        this.quiet = opts.quiet
        this.profile = opts.profile;

        this.c_profiles = Module.intArrayFromString(JSON.stringify({"profile": this.profile}));
        this.c_profile = Module.intArrayFromString("profile");

        this.opts = opts
        this.opt = Module.ccall('quiet_decoder_profile_str', 'pointer', ['array', 'array'], [this.c_profiles, this.c_profile]);
        // inform quiet about our local sound card's sample rate so that it can resample to its internal sample rate
        this.decoder = Module.ccall('quiet_decoder_create', 'pointer', ['pointer', 'number'], [this.opt, this.quiet.audioCtx.sampleRate]);

        this.audioDestination = this.quiet.audioCtx.createMediaStreamDestination()
        this.scriptProcessor = this.initScriptProcessor()

        this.audioStreams = opts.audioStreams
        this.audioInputs = []
        this.audioStreams.forEach((audioStream)=>{
            this.addAudioStream(audioStream)
        })
        this.scriptProcessor.connect(this.audioDestination)

        this.init()

    }

    addAudioStream(audioStream: MediaStream){
        const audioInput = this.quiet.audioCtx.createMediaStreamSource(audioStream)
        this.audioInputs.push(audioInput)
        if (this.audioStreams.indexOf(audioStream) === -1){
            this.audioStreams.push(audioStream)
        }
        audioInput.connect(this.scriptProcessor);
    }

    init(){

        Module.ccall('free', null, ['pointer'], [this.opt]);

        this.samples = Module.ccall('malloc', 'pointer', ['number'], [4 * this.quiet.sampleBufferSize]);

        this.frame = Module.ccall('malloc', 'pointer', ['number'], [this.quiet.frameBufferSize]);

        if (this.opts.onReceiverStatsUpdate !== undefined) {
            Module.ccall('quiet_decoder_enable_stats', null, ['pointer'], [this.decoder]);
        }

        // 代替destroyed
        this.inited = true;

        this.lastChecksumFailCount = 0;
        this.last_consume_times = [];
        this.num_consume_times = 3;

    }

    readbuf() {
        if (!this.inited) {
            return;
        }
        while (true) {
            var read = Module.ccall('quiet_decoder_recv', 'number', ['pointer', 'pointer', 'number'], [this.decoder, this.frame, this.quiet.frameBufferSize]);
            if (read === -1) {
                break;
            }
            // convert from emscripten bytes to js string. more pointer arithmetic.
            const frameArray = Module.HEAP8.slice(this.frame, this.frame + read);
            this.opts.onReceive(frameArray.buffer);
        }
    }

    consume() {
        if (!this.inited) {
            return;
        }
        const before = Date.now();
        Module.ccall('quiet_decoder_consume', 'number', ['pointer', 'pointer', 'number'], [this.decoder, this.samples, this.quiet.sampleBufferSize]);
        const after = Date.now();

        this.last_consume_times.unshift(after - before);
        if (this.last_consume_times.length > this.num_consume_times) {
            this.last_consume_times.pop();
        }

        window.setTimeout(()=>{
            this.readbuf()
        }, 0);

        const currentChecksumFailCount = Module.ccall('quiet_decoder_checksum_fails', 'number', ['pointer'], [this.decoder]);

        setTimeout(()=>{
            if (currentChecksumFailCount > this.lastChecksumFailCount){
                this.lastChecksumFailCount = currentChecksumFailCount;
                if (this.opts.onReceiveFail) {
                    this.opts.onReceiveFail(currentChecksumFailCount);
                }else{
                    console.error("onReceiveFail", currentChecksumFailCount);
                }
            }
        }, 0)

        if (this.opts.onReceiverStatsUpdate) {

            var num_frames_ptr = Module.ccall('malloc', 'pointer', ['number'], [4]);
            var frames = Module.ccall('quiet_decoder_consume_stats', 'pointer', ['pointer', 'pointer'], [this.decoder, num_frames_ptr]);
            // time for some more pointer arithmetic
            var num_frames = Module.HEAPU32[num_frames_ptr/4];
            Module.ccall('free', null, ['pointer'], [num_frames_ptr]);

            var framesize = 4 + 4 + 4 + 4 + 4;
            var stats = [];

            for (var i = 0; i < num_frames; i++) {
                var frame = (frames + i*framesize)/4;
                var symbols = Module.HEAPU32[frame];
                var num_symbols = Module.HEAPU32[frame + 1];
                const frameStats:FrameStats = {
                    errorVectorMagnitude: Module.HEAPF32[frame + 2],
                    receivedSignalStrengthIndicator: Module.HEAPF32[frame + 3],
                    symbols: [],
                }

                for (var j = 0; j < num_symbols; j++) {
                    var symbol = (symbols + 8*j)/4;
                    frameStats.symbols.push({
                        real: Module.HEAPF32[symbol],
                        imag: Module.HEAPF32[symbol + 1]
                    });
                }
                stats.push(frameStats);
            }
            this.opts.onReceiverStatsUpdate(stats);
        }
    }

    initScriptProcessor(){
        if (this.inited){
            throw new Error("Not inited")
        }
        // TODO investigate if this still needs to be placed on window.
        // seems this was done to keep it from being collected
        const scriptProcessor = this.quiet.audioCtx.createScriptProcessor(this.quiet.sampleBufferSize, 2, 1);
        this.idx = this.quiet.receivers_idx;
        this.quiet.receivers[this.idx] = this.scriptProcessor;
        this.quiet.receivers_idx++;

        scriptProcessor.onaudioprocess = (e:AudioProcessingEvent) => {
            if (!this.inited) {
                return;
            }
            var input = e.inputBuffer.getChannelData(0);
            this.sample_view = Module.HEAPF32.subarray(this.samples/4, this.samples/4 + this.quiet.sampleBufferSize);
            this.sample_view.set(input);

            window.setTimeout(()=>{
                this.consume()
            }, 0);
        }
        return scriptProcessor;
    }

    destroy(){
        if (!this.inited) {
            return;
        }
        this.scriptProcessor.disconnect();
        Module.ccall('free', null, ['pointer'], [this.samples]);
        Module.ccall('free', null, ['pointer'], [this.frame]);
        // 不要释放decoder
        // Module.ccall('quiet_decoder_destroy', null, ['pointer'], [this.quiet.decoder]);
        delete this.quiet.receivers[this.idx];
        this.inited = false;
    }

    getAverageDecodeTime () {
        if (this.last_consume_times.length === 0) {
            return 0;
        }
        var total = 0;
        for (var i = 0; i < this.last_consume_times.length; i++) {
            total += this.last_consume_times[i];
        }
        return total/(this.last_consume_times.length);
    };
}
