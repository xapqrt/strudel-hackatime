//content script injected into strudel.cc
//hooks codemirror editor and sends heartbeats



import { HeartbeatTracker } from './tracker'
import { MetadataExtractor } from './metadata'
import { heartbeat } from './types'




let tracker: HeartbeatTracker | null = null
let extractor: MetadataExtractor | null = null


let editorView: any = null


let lastActivity = 0






//try to find codemirror editor


function findEditor(): any {


    //strudel uses codemirror 6

    

    //method 1: check window object for exposed editor

    if((window as any).strudelEditor) {

        console.log('found strudel editor on window')
        return (window as any).strudelEditor
    }




    //method 2: look in DOM for cm element

    const cmElements = document.querySelectorAll('.cm-editor')


    if(cmElements.length > 0) {

        console.log(`found ${cmElements.length} cm editors in dom`)



        //try to get view from element

        for(const el of cmElements) {

            if((el as any).CodeMirror) {

                return (el as any).CodeMirror
            }


            //cm6 stores view differently


            if((el as any).cmView) {
                return (el as any).cmView.view
            }
        }
    }




    //method 3: polling fallback - check again later

    console.log('editor not found yet, will retry')
    return null
}






//init tracker when editor found


function initTracker(view: any): void {


    console.log('initializing tracker with editor')



    editorView = view
    tracker = new HeartbeatTracker()
    extractor = new MetadataExtractor(view)



    tracker.setExtractor(extractor)



    //hook into editor events

    attachEditorListeners()



    console.log('tracker ready')
}






//attach listeners to codemirror


function attachEditorListeners(): void {


    if(!editorView) return




    //cm6 uses updateListener extension

    try {


        //detect typing

        editorView.dom.addEventListener('input', () => {

            handleEdit()
        })




        //detect cursor movement

        editorView.dom.addEventListener('click', () => {

            handleRead()
        })




        editorView.dom.addEventListener('keydown', (e: KeyboardEvent) => {


            //arrow keys = cursor movement

            if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {

                handleRead()
            }


            //typing keys

            else if(e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {

                handleEdit()
            }
        })




        console.log('editor listeners attached')


    } catch(e) {

        console.error('failed to attach listeners:', e)
    }
}






//handle edit event


function handleEdit(): void {


    const now = Date.now()
    lastActivity = now



    if(!tracker) return



    const beat = tracker.recordEdit()



    if(beat) {

        sendBeat(beat)
    }
}






//handle read event


function handleRead(): void {


    const now = Date.now()
         


    //dont spam read events

    if(now - lastActivity < 5000) {

        return
    }



    lastActivity = now



    if(!tracker) return



    const beat = tracker.recordRead()



    if(beat) {

        sendBeat(beat)
    }
}






//send beat to background worker


function sendBeat(beat: heartbeat): void {


    try {

        chrome.runtime.sendMessage({

            type: 'HEARTBEAT',
            beat: beat

        }, (response) => {


            if(chrome.runtime.lastError) {

                console.error('send beat failed:', chrome.runtime.lastError)

            } else {

                console.log('beat sent to background')
            }
        })


    } catch(e) {

        console.error('failed to send beat:', e)
    }
}






//poll for editor with exponential backoff


let pollAttempts = 0
const maxAttempts = 20




function pollForEditor(): void {


    const view = findEditor()



    if(view) {

        initTracker(view)
        return
    }




    pollAttempts++



    if(pollAttempts >= maxAttempts) {

        console.error('gave up finding editor after', pollAttempts, 'attempts')
        return
    }




    //exponential backoff

    const delay = Math.min(100 * Math.pow(1.5, pollAttempts), 5000)



    console.log(`retry ${pollAttempts} in ${delay}ms`)



    setTimeout(pollForEditor, delay)
}






//start when dom ready


if(document.readyState === 'loading') {

    document.addEventListener('DOMContentLoaded', () => {

        console.log('dom loaded, looking for editor')
        pollForEditor()
    })


} else {

    console.log('dom already loaded')
    pollForEditor()
}




console.log('strudel hackatime content script loaded')
