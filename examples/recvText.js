const startReceiver = async ()=>{
    const quiet = new Quiet.Quiet()
    await quiet.init({
        profiles: profiles
    })
    console.log("quiet", quiet)
    const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    })
    const audioTrack = audioStream.getAudioTracks()[0]
    console.log("audioTrack", audioTrack)
    window.audioTrack = audioTrack
    console.log(audioTrack.getSettings())
    const textDecoder = new TextDecoder()
    Object.keys(profiles).forEach(async (profileName)=>{
        const receiverOptions = {
            audioStreams: [audioStream],
            profileName: profileName,
            onReceive: function(arrayBuffer){
                console.log("onReceive", profileName, textDecoder.decode(arrayBuffer))
            }
        }
        const receiver =  await quiet.receiver(receiverOptions)
        console.log("receiver", profileName, receiver);
    })
}
