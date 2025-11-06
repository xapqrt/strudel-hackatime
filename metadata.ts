//will try to extract cursor and line metadata

import { HeartbeatMetadata } from './types.js'




export class MetadataExtractor {
    private cm_view: any = null
    public pageScriptState: any = null

    constructor(view: any) {
        this.cm_view = view
    }


    //pulls all the cursor stuff hackatime wants

    getCursorMeta(): HeartbeatMetadata {
        
        // Try page script state first (more reliable)
        if (this.pageScriptState) {
            console.log('[METADATA] using page script state:', {
                lines: this.pageScriptState.totalLines,
                lineno: this.pageScriptState.lineNumber,
                cursorpos: this.pageScriptState.columnNumber
            })
            return {
                lines: this.pageScriptState.totalLines,
                lineno: this.pageScriptState.lineNumber,
                cursorpos: this.pageScriptState.columnNumber
            }
        }
        
        console.log('[METADATA] no page script state, trying cm_view')

        try {
            const state = this.cm_view.state
            
            if(!state) {
                if ((globalThis as any).__METADATA_VERBOSE) console.log('no state found, using defaults')
                return { lines: 1, lineno: 1, cursorpos: 1 }
            }
            
            const sel = state.selection.main
            const pos = sel.head


            if ((globalThis as any).__METADATA_VERBOSE) console.log("cursor at:", pos)




            //convert pos to line num one indexed for wakatime
            const line = state.doc.lineAt(pos)
            const lineNo = line.number
            const col = pos - line.from + 1

            const totalLines=state.doc.lines


            if ((globalThis as any).__METADATA_VERBOSE) console.log(`line ${lineNo}, col ${col}, total ${totalLines}`)


            return {
                lines: totalLines,
                lineno: lineNo,
                cursorpos: col
            }
        } catch(e) {
            if ((globalThis as any).__METADATA_VERBOSE) console.log('error getting cursor meta, using defaults:', e)
            return { lines: 1, lineno: 1, cursorpos: 1 }
        }

        //will maybe track selective range too ngl
    }


    getEntity(): string {
        //try to extract pattern name from URL hash

        const hash=window.location.hash




        if(hash&&hash.length>1){

            return `strudel-${hash.slice(1,10)}.js`
        }




        //fallback

        return "strudel-pattern-main.js"
    }






    //idk if i need this but might be useful later

    async getProject(): Promise<string> {


        //get configured project name from storage
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_CONFIG' })
            
            if(response && response.projectName) {
                return response.projectName
            }
        } catch(e) {
            if ((globalThis as any).__METADATA_VERBOSE) console.log('failed to get project name from config:', e)
        }

        //try to parse from url or just use default

        const url = window.location.href


        if(url.includes('strudel.cc')){
            return "strudel-live-coding"
        }



        return "strudel"
    }
}