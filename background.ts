//background service worker for sending heartbeats to hackatime



import { heartbeat, QueuedBeat } from './types'
import { Store } from './storage'




const store = new Store()


const API_BASE = 'https://hackatime.hackclub.com/api/hackatime/v1'
const BATCH_INTERVAL = 60000 




//listen for heartbeats from content script


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {


    if(msg.type === 'HEARTBEAT') {

        console.log('got beat from content:', msg.beat)
        

        queueBeat(msg.beat)
        sendResponse({ ok: true })


    } else if(msg.type === 'GET_CONFIG') {


        //popup asking for config

        store.loadConfig().then(cfg => {
            sendResponse(cfg)
        })

        return true  //async response
    }



    else if(msg.type === 'SAVE_CONFIG') {

        store.saveConfig(msg.config).then(() => {
            sendResponse({ ok: true })
        })

        return true
    }
})






//queue a beat for sending later


async function queueBeat(beat: heartbeat): Promise<void> {


    try {

        const queue = await store.getQueue()


        const queued: QueuedBeat = {

            beat: beat,
            retries: 0,
            queued_at: Date.now()
        }



        queue.push(queued)


        await store.saveQueue(queue)

        console.log(`queued beat, now ${queue.length} in queue`)



        //try to send immediately

        processQueue()


    } catch(e) {
        console.error('failed to queue beat:', e)
    }
}






//send queued beats to hackatime


async function processQueue(): Promise<void> {


    try {

        const cfg = await store.loadConfig()



        if(!cfg.apiKey || !cfg.enabled) {

            console.log('no api key or disabled, skipping')
            return
        }




        let queue = await store.getQueue()


        if(queue.length === 0) {
            return
        }




        console.log(`processing ${queue.length} beats`)




        //send each beat

        const remaining: QueuedBeat[] = []


        for(const qb of queue) {


            const success = await sendBeat(qb.beat, cfg.apiKey)



            if(!success) {

                qb.retries++



                if(qb.retries < 5) {

                    remaining.push(qb)  //retry later
                    console.log(`beat failed, retry ${qb.retries}`)

                } else {

                    console.log('beat failed too many times, dropping')
                }


            } else {

                console.log('beat sent successfully')



                //update last sync time

                await store.saveConfig({ lastSync: Date.now() })
            }
        }




        //save remaining beats

        await store.saveQueue(remaining)


    } catch(e) {
        console.error('queue processing borked:', e)
    }
}






//actually send a beat to api


async function sendBeat(beat: heartbeat, apiKey: string): Promise<boolean> {


    try {

        const url = `${API_BASE}/users/current/heartbeats`



        const response = await fetch(url, {

            method: 'POST',
            headers: {

                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'strudel-hackatime/0.1.0'
            },

            body: JSON.stringify(beat)
        })




        if(response.ok) {

            console.log('api responded ok')
            return true


        } else {

            const txt = await response.text()
            console.error(`api error ${response.status}:`, txt)

            return false
        }



    } catch(e) {

        console.error('fetch failed:', e)
        return false
    }
}






//periodic queue processor


setInterval(() => {

    console.log('periodic queue check')
    processQueue()

}, BATCH_INTERVAL)




//prune old beats daily


setInterval(() => {

    console.log('pruning old beats')
    store.pruneQueue()

}, 86400000)  

//copilot helped to verify this upper one time




console.log('background worker ready')
