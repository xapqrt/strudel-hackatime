//popup logic for settings and stats



//load config and stats on popup open


document.addEventListener('DOMContentLoaded', () => {


    loadConfig()
    loadStats()
    loadQueueSize()



    //save button

    document.getElementById('saveBtn')?.addEventListener('click', saveConfig)



    //retry button

    document.getElementById('retryBtn')?.addEventListener('click', retryQueue)
})






//load current config


async function loadConfig(): Promise<void> {


    try {

        const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })



        if(response) {

            const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement


            const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement




            if(apiKeyInput) {
                apiKeyInput.value = response.apiKey || ''
            }



            if(enabledCheckbox) {

                enabledCheckbox.checked = response.enabled !== false
            }



            console.log('loaded config into popup')
        }


    } catch(e) {

        console.error('failed to load config:', e)
        showStatus('failed to load settings', 'error')
    }
}






//save config


async function saveConfig(): Promise<void> {


    const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement
    const enabledCheckbox = document.getElementById('enabled') as HTMLInputElement




    const config = {

        apiKey: apiKeyInput?.value || '',
        enabled: enabledCheckbox?.checked !== false
    }




    try {

        await chrome.runtime.sendMessage({

            type: 'SAVE_CONFIG',
            config: config
        })



        showStatus('settings saved', 'success')


        //reload stats after save

        setTimeout(() => {
            loadStats()
        }, 500)


    } catch(e) {

        console.error('failed to save config:', e)
        showStatus('save failed', 'error')
    }
}






//load stats from api


async function loadStats(): Promise<void> {


    try {


        //fetch fresh stats from api

        const apiStats = await chrome.runtime.sendMessage({ type: 'FETCH_STATS' })



        let totalTime = 0
        let lastSync = 0



        if(apiStats && !apiStats.error) {


            totalTime = apiStats.todaySeconds || 0
            lastSync = apiStats.lastSync || 0


            console.log('loaded fresh stats from api')


        } else {


            //fallback to cached

            const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })


            if(response) {

                totalTime = response.totalTime || 0
                lastSync = response.lastSync || 0


                console.log('using cached stats')
            }
        }




            //today time

            const todayEl = document.getElementById('todayTime')

            if(todayEl) {

                const hours = Math.floor(totalTime / 3600)
                const mins = Math.floor((totalTime % 3600) / 60)

                if(hours > 0) {

                    todayEl.textContent = `${hours}h ${mins}m`

                } else if(mins > 0) {

                    todayEl.textContent = `${mins}m`

                } else {

                    todayEl.textContent = '0m'
                }
            }




        //last sync

        const lastSyncEl = document.getElementById('lastSync')

        if(lastSyncEl) {

            if(lastSync && lastSync > 0) {

                const diff = Date.now() - lastSync
                const mins = Math.floor(diff / 60000)



                if(mins < 1) {

                    lastSyncEl.textContent = 'just now'

                } else if(mins < 60) {

                    lastSyncEl.textContent = `${mins}m ago`

                } else {

                    const hrs = Math.floor(mins / 60)
                    lastSyncEl.textContent = `${hrs}h ago`
                }


            } else {

                lastSyncEl.textContent = 'never'
            }
        }


    } catch(e) {

        console.error('failed to load stats:', e)
    }
}






//load queue size


async function loadQueueSize(): Promise<void> {


    try {

        const response = await chrome.runtime.sendMessage({ type: 'GET_QUEUE_SIZE' })



        if(response && response.size !== undefined) {


            const queueItem = document.getElementById('queueItem')
            const queueSize = document.getElementById('queueSize')
            const retryBtn = document.getElementById('retryBtn')



            if(response.size > 0) {


                //show queue stat

                if(queueItem) {
                    queueItem.style.display = 'flex'
                }


                if(queueSize) {
                    queueSize.textContent = `${response.size} beats`
                }



                //show retry button

                if(retryBtn) {
                    retryBtn.style.display = 'block'
                }


            } else {


                //hide if empty

                if(queueItem) {
                    queueItem.style.display = 'none'
                }


                if(retryBtn) {
                    retryBtn.style.display = 'none'
                }
            }
        }


    } catch(e) {

        console.error('failed to load queue size:', e)
    }
}






//retry failed beats


async function retryQueue(): Promise<void> {


    try {

        showStatus('retrying...', 'success')



        await chrome.runtime.sendMessage({ type: 'RETRY_QUEUE' })



        showStatus('retry complete', 'success')



        //reload queue size after retry

        setTimeout(() => {

            loadQueueSize()
            loadStats()

        }, 1000)


    } catch(e) {

        console.error('retry failed:', e)
        showStatus('retry failed', 'error')
    }
}






//show status message


function showStatus(msg: string, type: 'success' | 'error'): void {


    const statusEl = document.getElementById('status')



    if(statusEl) {

        statusEl.textContent = msg
        statusEl.className = `status ${type}`



        //clear after 3 sec

        setTimeout(() => {

            statusEl.textContent = ''
            statusEl.className = 'status'

        }, 3000)
    }
}
