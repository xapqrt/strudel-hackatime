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



    else if(msg.type === 'GET_QUEUE_SIZE'){

        //ppoup asking for queue size



        store.getQueue().then(q => {
            sendResponse({size: q.length})
        })  

            
        


        return true
    }

    else if(msg.type === 'RETRY_QUEUE'){



        //manual retry from popup


        console.log('manual retry triggered')

        processQueue().then(() => {

            sendResponse({ ok: true})
        })


        return true
    }



    else if(msg.type === 'FETCH_STATS') {


        //popup wants real stats from api


        fetchStatsFromAPI().then(stats => {

            sendResponse(stats)
        }).catch(e => {

            console.error('stats fetch failed:', e)
            sendResponse({ error: true })
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



        //update badge

        
        updateBadge(queue.length)



        //try to send immediately

        processQueue()


    } catch(e) {
        console.error('failed to queue beat:', e)
    }
}






//update extension badge with queue size


async function updateBadge(count?: number): Promise<void> {


    try {

        if(count === undefined) {

            const q = await store.getQueue()
            count = q.length
        }


        if(count > 0) {

            chrome.action.setBadgeText({ text: count.toString() })
            chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' })  //orange

        } else {

            chrome.action.setBadgeText({ text: '' })
        }


    } catch(e) {

        console.error('badge update failed:', e)
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



        //update badge

        updateBadge(remaining.length)


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






//fetch stats from hackatime api


async function fetchStatsFromAPI(): Promise<any> {


    try {

        const cfg = await store.loadConfig()



        if(!cfg.apiKey) {

            console.log('no api key, cant fetch stats')
            return { error: true, message: 'no api key' }
        }




        //fetch today stats

        const today = new Date()
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const end = new Date(start)

        end.setDate(end.getDate() + 1)




        const startStr = start.toISOString().split('T')[0]
        const endStr = end.toISOString().split('T')[0]




        const url = `${API_BASE}/users/current/summaries?start=${startStr}&end=${endStr}`



        console.log('fetching stats from:', url)



        const response = await fetch(url, {

            method: 'GET',
            headers: {

                'Authorization': `Bearer ${cfg.apiKey}`,
                'Content-Type': 'application/json'
            }
        })




        if(response.ok) {

            const data = await response.json()


            console.log('got stats from api:', data)



            //extract today time

            let todaySeconds = 0


            if(data.data && data.data.length > 0) {

                todaySeconds = data.data[0].grand_total?.total_seconds || 0
            }




            //cache it

            await store.saveConfig({ 

                totalTime: todaySeconds,
                lastSync: Date.now()
            })



            return {

                todaySeconds: todaySeconds,
                lastSync: Date.now()
            }


        } else {

            const txt = await response.text()
            console.error(`stats api error ${response.status}:`, txt)

            return { error: true, status: response.status }
        }


    } catch(e) {

        console.error('stats fetch failed:', e)
        return { error: true, message: String(e) }
    }
}




console.log('background worker ready')
