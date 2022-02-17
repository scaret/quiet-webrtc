!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.Quiet=t():e.Quiet=t()}(self,(function(){return(()=>{"use strict";var e={d:(t,i)=>{for(var s in i)e.o(i,s)&&!e.o(t,s)&&Object.defineProperty(t,s,{enumerable:!0,get:i[s]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{InitRuntime:()=>c,Module:()=>i,Quiet:()=>r});const i={onRuntimeInitialized:function(){console.log("onRuntimeInitialized",...arguments)},locateFile:function(e,t){return console.log("locateFile",e,...arguments),t||(t="https://yunxin-g2-assets.oss-cn-hangzhou.aliyuncs.com/quiet-webrtc/"),t+e}};window.Module=i;class s{constructor(e){this.inited=!1,this.samples=0,this.lastChecksumFailCount=0,this.last_consume_times=[],this.num_consume_times=0,this.sample_view=new Float32Array,this.idx=0,this.quiet=e.quiet,this.profile=e.profile,this.c_profiles=i.intArrayFromString(JSON.stringify({profile:this.profile})),this.c_profile=i.intArrayFromString("profile"),this.opts=e,this.opt=i.ccall("quiet_decoder_profile_str","pointer",["array","array"],[this.c_profiles,this.c_profile]),this.decoder=i.ccall("quiet_decoder_create","pointer",["pointer","number"],[this.opt,this.quiet.audioCtx.sampleRate]),this.audioStream=e.audioStream,this.audioInput=this.quiet.audioCtx.createMediaStreamSource(this.audioStream),this.audioDestination=this.quiet.audioCtx.createMediaStreamDestination(),this.scriptProcessor=this.initScriptProcessor(),this.audioInput.connect(this.scriptProcessor),this.scriptProcessor.connect(this.audioDestination),this.init()}init(){i.ccall("free",null,["pointer"],[this.opt]),this.samples=i.ccall("malloc","pointer",["number"],[4*this.quiet.sampleBufferSize]),this.frame=i.ccall("malloc","pointer",["number"],[this.quiet.frameBufferSize]),void 0!==this.opts.onReceiverStatsUpdate&&i.ccall("quiet_decoder_enable_stats",null,["pointer"],[this.decoder]),this.inited=!0,this.lastChecksumFailCount=0,this.last_consume_times=[],this.num_consume_times=3}readbuf(){if(this.inited)for(;;){var e=i.ccall("quiet_decoder_recv","number",["pointer","pointer","number"],[this.decoder,this.frame,this.quiet.frameBufferSize]);if(-1===e)break;const t=i.HEAP8.slice(this.frame,this.frame+e);this.opts.onReceive(t.buffer)}}consume(){if(!this.inited)return;const e=Date.now();i.ccall("quiet_decoder_consume","number",["pointer","pointer","number"],[this.decoder,this.samples,this.quiet.sampleBufferSize]);const t=Date.now();this.last_consume_times.unshift(t-e),this.last_consume_times.length>this.num_consume_times&&this.last_consume_times.pop(),window.setTimeout((()=>{this.readbuf()}),0);const s=i.ccall("quiet_decoder_checksum_fails","number",["pointer"],[this.decoder]);if(setTimeout((()=>{s>this.lastChecksumFailCount&&(this.lastChecksumFailCount=s,this.opts.onReceiveFail?this.opts.onReceiveFail(s):console.error("onReceiveFail",s))}),0),this.opts.onReceiverStatsUpdate){var o=i.ccall("malloc","pointer",["number"],[4]),r=i.ccall("quiet_decoder_consume_stats","pointer",["pointer","pointer"],[this.decoder,o]),n=i.HEAPU32[o/4];i.ccall("free",null,["pointer"],[o]);for(var a=[],c=0;c<n;c++){var u=(r+20*c)/4,l=i.HEAPU32[u],h=i.HEAPU32[u+1];const e={errorVectorMagnitude:i.HEAPF32[u+2],receivedSignalStrengthIndicator:i.HEAPF32[u+3],symbols:[]};for(var d=0;d<h;d++){var m=(l+8*d)/4;e.symbols.push({real:i.HEAPF32[m],imag:i.HEAPF32[m+1]})}a.push(e)}this.opts.onReceiverStatsUpdate(a)}}initScriptProcessor(){if(this.inited)throw new Error("Not inited");const e=this.quiet.audioCtx.createScriptProcessor(this.quiet.sampleBufferSize,2,1);return this.idx=this.quiet.receivers_idx,this.quiet.receivers[this.idx]=this.scriptProcessor,this.quiet.receivers_idx++,e.onaudioprocess=e=>{if(this.inited){var t=e.inputBuffer.getChannelData(0);this.sample_view=i.HEAPF32.subarray(this.samples/4,this.samples/4+this.quiet.sampleBufferSize),this.sample_view.set(t),window.setTimeout((()=>{this.consume()}),0)}},e}destroy(){this.inited&&(this.scriptProcessor.disconnect(),i.ccall("free",null,["pointer"],[this.samples]),i.ccall("free",null,["pointer"],[this.frame]),delete this.quiet.receivers[this.idx],this.inited=!1)}getAverageDecodeTime(){if(0===this.last_consume_times.length)return 0;for(var e=0,t=0;t<this.last_consume_times.length;t++)e+=this.last_consume_times[t];return e/this.last_consume_times.length}}let o=null;class r{constructor(e){this.emscriptenInitialized=!1,this.inited=!1,this.profiles={},this.frameBufferSize=Math.pow(2,14),this.receivers={},this.receivers_idx=0,this.sampleBufferSize=16384,window.AudioContext?this.audioCtx=new AudioContext(e):this.audioCtx=new webkitAudioContext(e)}async init(e){this.profiles=e.profiles,this.inited=!0,this.resume(),await c()}async resume(){"suspended"===this.audioCtx.state&&await this.audioCtx.resume()}async receiver(e){const t=e.audioStream||await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1}}),i=e.onReceive||function(t){var i;console.log("onReceive",e.profileName,(i=t,o||(o=new TextDecoder),o.decode(i)))},r=this.profiles[e.profileName];if(!r)throw new Error(`Cannot find profile [${e.profileName}]. Available profileNames: ${Object.keys(this.profiles).join()}`);const n={profile:r,audioStream:t,quiet:this,onReceive:i,onReceiveFail:e.onReceiveFail,onReceiverStatsUpdate:e.onReceiverStatsUpdate};return n.quiet=this,new s(n)}}let n="UNINIT";const a=[];async function c(){if("INITED"!==n)return new Promise((e=>{if(a.push(e),"UNINIT"===n){n="INITING";const e=Date.now(),t=document.createElement("script");t.async=!0,t.src=i.locateFile("quiet-emscripten.js"),document.body.appendChild(t),i.onRuntimeInitialized=function(){n="INITED",console.log("onRuntimeInitialized",Date.now()-e),a.forEach((e=>{e()}))}}}))}return t})()}));
//# sourceMappingURL=Quiet.js.map