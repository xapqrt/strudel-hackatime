//heartbeat tracking file, dis also crated a basic payload


import { heartbeat, HeartbeatMetadata } from './types.js'
import { MetadataExtractor } from './metadata.js'






export class HeartbeatTracker {

    private lastBeatTime: number = 0
    private lastEntity: string = ''
    private extractor: MetadataExtractor | null = null

    private THROTTLE_MS = 30000  
    
    //30 seconds wakatime spec


    constructor() {
        // minimal logging
        const VERBOSE = false
        function log(...args: any[]) { if (VERBOSE) console.log(...args) }
        log("tracker init")
    }


    //set the metadata extractor

    setExtractor(ext: MetadataExtractor): void {
        this.extractor = ext
        // debug
        if ((globalThis as any).__TRACKER_VERBOSE) console.log("extractor attached")
    }






    //check if we should send a heartbeat 




    shouldSendBeat(entity: string): boolean {


        const now = Date.now()
        const timeSinceLast = now - this.lastBeatTime


        //send if its been more than rate limit seconds

        if(timeSinceLast >= this.THROTTLE_MS) {
            return true
        }


        //if files or pattern switched
        if(entity !== this.lastEntity) {
            return true
        }


        return false
    }


    //create a heartbeat object
    async createBeat(isWrite: boolean): Promise<heartbeat | null> {

        if(!this.extractor) {
            console.error("no extractor attached yet")
            return null
        }


        try {


            const meta: HeartbeatMetadata = this.extractor.getCursorMeta()
            const entity = this.extractor.getEntity()
            const project = await this.extractor.getProject()




            //check rate limit

            if(!this.shouldSendBeat(entity)) {
                // throttled - don't spam logs
                if ((globalThis as any).__TRACKER_VERBOSE) console.log("throttled, skipping beat")
                return null
            }






            //create the beat
            // WakaTime recognizes editor through multiple fields:
            // 1. X-Machine-Name HTTP header (set in background.ts/offscreen.ts)
            // 2. plugin field (this is what shows in dashboard)
            // 3. editor field (fallback)

            const beat: heartbeat = {
                entity: entity,
                type: "file",
                time: Date.now() / 1000,  
                language: "JavaScript",
                is_write: isWrite,
                project: project,
                
                // These fields work together to identify the editor
                editor: "Strudel",
                plugin: "Strudel/1.0.0 strudel-wakatime/1.0.0",

                //optional metadata
                lines: meta.lines,
                lineno: meta.lineno,
                cursorpos: meta.cursorpos,
                category: "coding"
            }
            
            console.log('metadata being sent:', {
                lines: meta.lines,
                lineno: meta.lineno, 
                cursorpos: meta.cursorpos
            })
            
            console.log('beat created with project:', project)






            //update tracking

            this.lastBeatTime = Date.now()
            this.lastEntity = entity



            if ((globalThis as any).__TRACKER_VERBOSE) console.log("created beat:", beat)
            return beat

        } catch(e) {
            console.error("failed to create beat:", e)
            return null
        }
    }


    //record typing 

    async recordEdit(): Promise<heartbeat | null> {
        return await this.createBeat(true)
    }


    //reading one, it shows on hackatime i saw

    async recordRead(): Promise<heartbeat | null> {
        return await this.createBeat(false)
    }


    //manual reset when i debug
    reset(): void {
        this.lastBeatTime = 0
        this.lastEntity = ''

        if ((globalThis as any).__TRACKER_VERBOSE) console.log("tracker reset")
    }
}
