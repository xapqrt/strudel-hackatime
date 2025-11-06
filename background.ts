//background service worker for sending heartbeats to hackatime

//holy long file, took the most mount of time

//very core file too mind u



import { heartbeat, QueuedBeat } from './types.js'
import { Store } from './storage.js'




const store = new Store()


//hey josias btw everything fromt he docs
const API_BASE = 'https://hackatime.hackclub.com/api/hackatime/v1'
const BATCH_INTERVAL = 60000








//adding the user agent header as to try to inject editor name



chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [{
                    header: 'User-Agent',

                    operation: 'set',
                    value: 'wakatime/v1.0.0 (chrome-extension) strudel-wakatime/0.1.0'
                }]



            },
            condition: {
                urlFilter: '*://hackatime.hackclub.com/*',
                resourceTypes: ['xmlhttprequest']  // Specifically target XHR for better reliability
            }


        }]
    }).then(() => {

        console.log('       User-Agent header rule set for Hackatime API')
        console.log('            URL Filter: *://hackatime.hackclub.com/*')
        console.log('                    User-Agent: wakatime/v1.0.0 (chrome-extension) strudel-wakatime/0.1.0')
        
        






        // second attempt of editor name



        chrome.declarativeNetRequest.getDynamicRules().then(rules => {
            console.log('will try to seach for dnr rules broski:', rules)
            if (rules.length === 0) {


                console.error('does not work this shi brochaho')
            } else {


                console.log('Rule count:', rules.length)
            }


        })
    }).catch(err => {
        console.error('asnt able to set err:', err)
    })
})







//js offscreen doc for xhr, perplexity said this might*might* i emphasize fix it


//attempt 4


async function setupOffscreenDocument() {


    //check if chrome.offscreen exists



    if(!chrome.offscreen) {


        console.log('nah dis shit off')
        return
    }





    try{




        //check if already exists


        const existing = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT' as any]
        })


        
        
        if(existing.length > 0) {


            console.log(' might exists')
            return  
        }
    
        
        
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',


            reasons: ['DOM_SCRAPING' as any],

            justification: 'xhr for api calls'
        })


        console.log('offscreen doc created')

    }catch(e){

        console.error('couldnt create offscreen:', e)
    }


}

console.log('alr startin the background service worker')






//please dont die



setupOffscreenDocument()




chrome.declarativeNetRequest.getDynamicRules().then(rules => {

    console.log(' dnr rule tryna select')


    if (rules.length === 0) {
        console.error('nah cant see no useragent')

        
    } 
    
    else {




        console.log('Found', rules.length, 'active rule(s):', rules)
    }
}) 




//listen for heartbeats from content script



chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {


    if(msg.type === 'HEARTBEAT') {

        console.log('got beat from content:', msg.beat)
        


        // Try to send immediately, only queue if failed js like tihs vs code one



        handleBeat(msg.beat)
        sendResponse({ ok: true })


    } else if(msg.type === 'GET_CONFIG') {



        //popup asking for config



        store.loadConfig().then(cfg => {
            sendResponse(cfg)
        })

        return true  
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






//alr this the beat handler, hope it doesnt explode when i debug, website crashed twice


async function handleBeat(beat: heartbeat): Promise<void> {
    try {





        const cfg = await store.loadConfig()
        

        console.log('checking config')


        console.log('   API Key:', cfg.apiKey ? `${cfg.apiKey.slice(0, 8)}...` : 'NOT SET')

        console.log('   Enabled:', cfg.enabled !== false ? ' YES' : 'NO')
        
        if (!cfg.apiKey) {
            console.error('NO API KEY SET! Go to extension popup and add your Hackatime API key!')
            await queueBeat(beat)
            return
        }
        
        if (cfg.enabled === false) {
            console.log('extension disabled, queueing beat')
            await queueBeat(beat)
            return
        }
        
        console.log('tryna send beat now')
        const success = await sendBeat(beat, cfg.apiKey)
        
        if (success) {
            console.log(' beat sent, NOT queued')
            // Update stats
            cfg.beatCount = (cfg.beatCount || 0) + 1
            cfg.lastBeatTime = Date.now()
            await store.saveConfig(cfg)
        } else {
            console.log('send failed, queueing')
            await queueBeat(beat)
        }
        
    } catch(e) {
        console.error('Error handling beat:', e)
        await queueBeat(beat)
    }
}


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
        
        console.log('sending beat to:', url)
        console.log('payload:', JSON.stringify(beat, null,2))

        let response: any





        //try offscreen doc first (for xhr)

        //dis might fix the editor one

        try{
            console.log('trying offscreen doc with xhr')
            response = await chrome.runtime.sendMessage({



                type: 'SEND_HEARTBEAT',
                url: url,
                payload: beat,
                apiKey: apiKey


            })
            


            console.log('got response from offscreen:', response)
        }catch(e){
            console.log('fall back fetch:', e)
            response = null
        }
        

        
        if(!response){
            console.log('using regular fetch')

            const fetchResp = await fetch(url, {

                method: 'POST',
                headers: {


                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'


                },
                body: JSON.stringify(beat)
            })
            
            response = {


                success: fetchResp.ok,

                status: fetchResp.status,

                responseText: await fetchResp.text()


            }
        }




        //response when success i gotta know

        if(response.success && response.status >= 200 && response.status < 300) {


            console.log('api ok!')

            console.log('response:', response.responseText.substring(0, 200))
            
            // increment beat counter and update time
            const cfg = await store.loadConfig()
            cfg.beatCount = (cfg.beatCount || 0) + 1
            cfg.lastBeatTime = Date.now()
            await store.saveConfig(cfg)
            
            return true

        } else {
            console.error(`API error ${response.status}:`, response.responseText || response.error)
            
            
            if (response.status === 404) {



                const altUrl = 'https://hackatime.hackclub.com/api/v1/my/heartbeats'
                console.log('Trying:', altUrl)
                
                const altResponse = await fetch(altUrl, {
                    method: 'POST',



                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(beat)
                })


                

                if (altResponse.ok) {
                    console.log('the next one worked btw')
                    return true
                } else {
                    const altTxt = await altResponse.text()
                    console.error(`um change the url ig ${altResponse.status}:`, altTxt)
                }
            }

            return false
        }
        
    } catch(e) {
        console.error('Fetch failed:', e)
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




        const url = `${API_BASE}/summaries?start=${startStr}&end=${endStr}`



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
