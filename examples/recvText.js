const main = async ()=>{
    let profileNames = Object.keys(profiles)
    profileNames.forEach((profileName)=>{
        const option = document.createElement("option")
        option.value = profileName;
        option.innerText = profileName;
        document.getElementById("profile").appendChild(option)
    })
}
main()

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
    const receiverOptions = {
        audioStreams: [audioStream],
        profileName: document.getElementById("profile").value,
        onReceive: function(arrayBuffer){
            console.log("onReceive", textDecoder.decode(arrayBuffer))
        }
    }
    const receiver =  await quiet.receiver(receiverOptions)
    console.log("receiver", receiver);
}
