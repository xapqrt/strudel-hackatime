//the hooking of cm6 and when actual logged

//took so long bruv


import { HeartbeatTracker } from './tracker.js'
import { MetadataExtractor } from './metadata.js'
import { heartbeat } from './types.js'

const VERBOSE = false


function log(...args: any[]) { if (VERBOSE) console.log(...args) }



function clog(...args: any[]) { 
  console.log(`[HACKATIME]`, ...args) 

}

//above js logs

let tracker: HeartbeatTracker | null = null

let extractor: MetadataExtractor | null = null

let editorView: any = null

let lastActivity = 0


let isIdle = false

const IDLE_TIMEOUT = 300000 


//idk why ms \all bruh








//try to find codemirror editor



function findEditor(): any {

    log('findEditor called, checking methods...')

    //strudel uses cm6 perplexity helped in this one
    if((window as any).strudelEditor) {
    log('found strudel editor on window')
        return (window as any).strudelEditor
    }

    
    //check other common window properties
    if((window as any).editor) {
    log('found editor on window')
        return (window as any).editor
    }
    
    if((window as any).view) {
    log('found view on window')
        return (window as any).view
    }
    


    //check codemirrorSettings

    if((window as any).codemirrorSettings) {
    log('found codemirrorSettings')
        const settings = (window as any).codemirrorSettings

        if(settings.view) {
            log('found view in codemirrorSettings')


            return settings.view
        }
    }


    
    //check all window properties


    const windowKeys = Object.keys(window)


    for(const key of windowKeys) {

        const prop = (window as any)[key]


        if(prop && prop.state && prop.state.doc && prop.dispatch) {


            log('found Edview like object on window:', key)
            return prop
        }


    }



//dom for cm element liek this gotta work

    const cmElements = document.querySelectorAll('.cm-editor')


    if(cmElements.length > 0) {


    log(`found ${cmElements.length} cm editors in dom`)

        //default and placeholder as of now

        const el = cmElements[0]


    log('using cm element, metadata will use defaults')

        return { dom: el }
    }


    


    //i hope i never see this one


    log('editor not found yet, will retry')

    return null
}






//store latest editor state from page script


let pageScriptState: any = null


let pageScriptReady = false


// Promise-based request tracking



let pendingRequests = new Map<number, (state: any) => void>()
let requestId = 0



//inject page script to access CodeMirror in page context


function injectPageScript(): void {


    clog('💉', 'Injecting page script...')


    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('dist/page-script.js')


    clog('💉', 'Script URL:', script.src)


    script.onload = () => {


        clog( 'Page script loaded successfully')
    }


    script.onerror = (e) => {

        clog( 'Failed to load page script:', e)
    }


    ;(document.head || document.documentElement).appendChild(script)
}

//listen for messages from page script

window.addEventListener('message', (event) => {

    if (event.source !== window) return
    
    if (event.data.type === 'HACKATIME_PAGE_SCRIPT_READY') {
        pageScriptReady = true

        clog('page script ready signal received')
    }
    
    if (event.data.type === 'HACKATIME_STATE_RESPONSE') {

        const { requestId: respId, state } = event.data
        

        //updating cache state

        pageScriptState = state

        
        // js pending promises liek ma

        const resolver = pendingRequests.get(respId)

        if (resolver) {

            resolver(state)

            pendingRequests.delete(respId)
        }
        

        if (state) {


            clog('📨', 'Got state:', `line ${state.lineNumber}, col ${state.columnNumber}`)


        } else {


            clog('⚠️', 'Page script returned null state')
        }
    }
})

//request state from page script 


function requestPageScriptState(): Promise<any> {


    return new Promise((resolve) => {


        if (!pageScriptReady) {


            clog( 'Page script not ready yet, cannot request state')

            resolve(null)
            return
        }
        

        const currentId = requestId++


        pendingRequests.set(currentId, resolve)
        
        


        setTimeout(() => {


            if (pendingRequests.has(currentId)) {


                pendingRequests.delete(currentId)


                clog( 'Page script state request timed out')
                resolve(null)
            }


        }, 200) 
        

        log(' Requesting state from page script with ID:', currentId)


        window.postMessage({ 
            type: 'HACKATIME_GET_STATE',


            requestId: currentId 
        }, '*')
    })
}

function initTracker(view: any): void {


    clog( 'Found editor! Initializing tracker...')


    editorView = view


    tracker = new HeartbeatTracker()


    extractor = new MetadataExtractor(view)

    tracker.setExtractor(extractor)


    //hook into editor events


    attachEditorListeners()
    

    //inject page script for better metadata


    injectPageScript()

    clog('tracker initialized')


    clog('🎉', 'Extension is now tracking your edits on Strudel')
}






//attach listeners to codemirror

function attachEditorListeners(): void {


    if(!editorView) return


    try {

        // Try to get DOM element from various sources

        let domElement: HTMLElement | null = null
        
        if (editorView.dom) {
            domElement = editorView.dom

        } else if (editorView instanceof HTMLElement) {
            domElement = editorView
        } else {

            // Fallback: find .cm-content element

            domElement = document.querySelector('.cm-content') as HTMLElement
        }
        
        if (!domElement) {

            clog('couldnt find DOM element to attach listeners')
            return
        }
        
        clog('attaching listeners to:', domElement.className)

        //detect typing

        domElement.addEventListener('input', () => {

            handleEdit()
        })


        //detect cursor movement


        domElement.addEventListener('click', () => {


            handleRead()
        })

        domElement.addEventListener('keydown', (e: KeyboardEvent) => {


            //arrow keys = cursor movement


            if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {


                handleRead()
            }


            //typing keys


            else if(e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {


                handleEdit()
            }
        })

        clog('editor listeners attached')


    } catch(e) {


        console.error('failed to attach listeners:', e)
    }


}






//handle edit event

async function handleEdit(): Promise<void> {


    const now = Date.now()


    lastActivity = now


    //reset idle state


    if(isIdle) {


        isIdle = false

        log('user active again')
    }

    if(!tracker) return
    
    //request fresh state from page script and WAIT for Promise to resolve

    const state = await requestPageScriptState()
    
    //update extractor with page script state

    if(extractor && state) {

        extractor.pageScriptState = state

        clog('state received before beat')

    } else {

        clog('no state received, will use defaults')
    }

    const beat = await tracker.recordEdit()

    if(beat) {
        sendBeat(beat)
    }
}




//handle read event

async function handleRead(): Promise<void> {

    const now = Date.now()
         

    //dont spam read events


    if(now - lastActivity < 5000) {


        return
    }


    lastActivity = now


    //reset idle state


    if(isIdle) {


        isIdle = false


    log('user active again')
    }


    if(!tracker) return


    const beat = await tracker.recordRead()


    if(beat) {


        sendBeat(beat)
    }


}






//check idle state

function checkIdleState(): void {

    const now = Date.now()


    const timeSinceActivity = now - lastActivity


    if(!isIdle && timeSinceActivity >= IDLE_TIMEOUT) {

        isIdle = true


    log('user idle, pausing heartbeats')
    }


}



//start idle checker


setInterval(checkIdleState, 60000)  //check every min






//send beat to background worker

function sendBeat(beat: heartbeat): void {


    //skip if idle


    if(isIdle) {


        log('skipping beat, user idle')
        return
    }


    try {


        chrome.runtime.sendMessage({


            type: 'HEARTBEAT',


            beat: beat
        }, (response) => {


            if(chrome.runtime.lastError) {


                const error = chrome.runtime.lastError.message
                
                // Extension was reloaded - this is expected, don't spam errors


                if (error.includes('Extension context invalidated')) {


                    clog('⚠️', 'Extension was reloaded. Please refresh this page to reconnect.')


                    return
                }
                

                console.error('send beat failed:', chrome.runtime.lastError)


            } else {


                log('beat sent to background')
            }
        })


    } catch(e) {


        const errorMsg = String(e)
        
        // Extension context invalidated - graceful message


        if (errorMsg.includes('Extension context invalidated')) {

            clog('Extension was reloaded. Please refresh this page.')

        } else {

            console.error('failed to send beat:', e)
        }
    }


}






//poll for editor with exponential backoff

let pollAttempts = 0


const maxAttempts = 20


function pollForEditor(): void {


    const view = findEditor()


    if(view) {


        clog('editor found on attempt', pollAttempts + 1)


        initTracker(view)
        return
    }

    pollAttempts++


    if(pollAttempts >= maxAttempts) {


        clog(`couldnt find editor after ${pollAttempts} attempts`)


        clog('🔍', 'Switching to MutationObserver to watch for editor...')

        //fallback to mutation observer


        startMutationObserver() 
        return
    }


    //exponential backoff


    const delay = Math.min(100 * Math.pow(1.5, pollAttempts), 5000)

    if (pollAttempts === 1 || pollAttempts % 5 === 0) {


        clog(`looking for editor (attempt ${pollAttempts})`)
    }


    setTimeout(pollForEditor, delay)
}

//mutation observer to watch for editor appearing


let observer: MutationObserver | null = null 



function startMutationObserver(): void {

    log('starting mutation observer for editor')


    observer = new MutationObserver((mutations) => {

        //check if editor appeared


        for(const mutation of mutations) {

            if(mutation.addedNodes.length > 0) {

                const view = findEditor()


                if(view) {


                    log('mutation observer found editor')
                    

                    observer?.disconnect()


                    initTracker(view)

                    return
                }
            }
        }
    })



    //observe body for child changes


    observer.observe(document.body, {


        childList: true,


        subtree: true
    })


    log('watching for editor to appear')


}






//global activity tracking

function trackActivity(): void {


    lastActivity = Date.now()

    if(isIdle) {


        isIdle = false


        log('activity detected, user back')
    }


}



//listen for global mouse/keyboard activity

document.addEventListener('mousemove', trackActivity, { passive: true })


document.addEventListener('keypress', trackActivity, { passive: true })


document.addEventListener('scroll', trackActivity, { passive: true })






//start when dom ready


clog('🚀', 'Strudel Hackatime extension loaded')


clog('📍', 'URL:', window.location.href)


clog('🔍', 'Looking for CodeMirror editor...')


if(document.readyState === 'loading') {


    document.addEventListener('DOMContentLoaded', () => {


        log('dom loaded, looking for editor')


        pollForEditor()
    })

} else {


    log('dom already loaded')


    pollForEditor()
}