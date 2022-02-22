const profileName = "audible"
let quiet
let transmitter
let receiver
let textDecoder = new TextDecoder()
let timer

const startSendRecv = async ()=>{
    quiet = new Quiet.Quiet()
    await quiet.init({
        profiles: profiles
    })
    console.log("quiet", quiet)

    const transmitterOptions = {
        profileName: profileName,
        clampFrame: false,
    }
    transmitter = await quiet.transmitter(transmitterOptions)
    const receiverOptions = {
        audioStreams: [transmitter.stream],
        profileName: profileName,
        onReceive: function(arrayBuffer){
            const text = textDecoder.decode(arrayBuffer)
            const start = parseInt(text)
            const now = Date.now()
            document.getElementById("receiverDelay").innerText = `${now - start}`
        }
    }
    receiver = await quiet.receiver(receiverOptions)
    timer = setInterval(()=>{
        const start = Date.now()
        transmitter.transmitText("" + start)
        document.getElementById("senderDelay").innerText = `${Date.now() - start}`
    }, 1000)
}
