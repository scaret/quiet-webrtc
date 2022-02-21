let quiet = null
const transmitters = {}
window.transmitters = transmitters


const startSender = async ()=>{
    quiet = new Quiet.Quiet()
    await quiet.init({
        profiles: profiles
    })
    console.log("quiet", quiet)
    let profileNames = Object.keys(profiles)
    profileNames = ["audible"]
    profileNames.forEach(async (profileName)=>{
        if (!transmitters[profileName]){
            const transmitterOptions = {
                profileName: profileName,
                clampFrame: false,
            }
            const transmitter =  await quiet.transmitter(transmitterOptions)
            transmitters[profileName] = transmitter
            console.log("transmitter", profileName, transmitter);
            document.getElementById("audioElem").srcObject = transmitter.mediaStreamDestination.stream
        }

        // const text = "abc"
        // transmitter.transmit(textEncoder.encode(text))
    })
}

const sendText = async ()=>{
    if (!quiet){
        await startSender()
    }
    Object.values(transmitters).forEach(async (transmitter)=>{
        const text = document.getElementById("textToSend").value
        transmitter.transmitText(text)
    })
}
