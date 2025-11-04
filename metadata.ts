//will try to extract cursor and line metadata

import { HeartbeatMetadata } from './types'




export class MetadataExtractor {

    private cm_view: any = null




    constructor(view: any) {

        this.cm_view = view
    }






    //pulls all the cursor stuff hackatime wants


    getCursorMeta(): HeartbeatMetadata {


        const state = this.cm_view.state
        const sel = state.selection.main
        const pos = sel.head


        console.log("cursor at:", pos)




        //convert pos to line num one indexed for wakatime

        const line = state.doc.lineAt(pos)
        const lineNo = line.number
        const col = pos - line.from + 1



        const totalLines=state.doc.lines




        console.log(`line ${lineNo}, col ${col}, total ${totalLines}`)






        return {

            lines: totalLines,
            lineno: lineNo,
            cursorpos: col
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

    getProject(): string {


        //try to parse from url or just use default

        const url = window.location.href


        if(url.includes('strudel.cc')){
            return "strudel-live-coding"
        }



        return "strudel"
    }
}