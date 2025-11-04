//heartbeat tracking file, dis also crated a basic payload


import { heartbeat, HeartbeatMetadata } from './types'
import { MetadataExtractor } from './metadata'






export class HeartbeatTracker {


    private lastBeatTime: number = 0
    private lastEntity: string = ''

    private extractor: MetadataExtractor | null = null


    private THROTTLE_MS = 30000  
    
    //30 seconds wakatime spec




    constructor() {

        console.log("tracker init")
    }






    //set the metadata extractor



    setExtractor(ext: MetadataExtractor): void {

        this.extractor = ext
        console.log("extractor attached")
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

    createBeat(isWrite: boolean): heartbeat | null {


        if(!this.extractor) {

            console.error("no extractor attached yet")
            return null
        }




        try {


            const meta: HeartbeatMetadata = this.extractor.getCursorMeta()
            const entity = this.extractor.getEntity()
            const project = this.extractor.getProject()




            //check rate limit

            if(!this.shouldSendBeat(entity)) {

                console.log("throttled, skipping beat")
                return null
            }






            //create the beat


            const beat: heartbeat = {

                entity: entity,
                type: "file",
                time: Date.now() / 1000,  
                language: "javascript",
                is_write: isWrite,



                //optional metadata

                project: project,
                lines: meta.lines,
                lineno: meta.lineno,
                cursorpos: meta.cursorpos,
                category: "coding",
                branch: "main"
            }






            //update tracking

            this.lastBeatTime = Date.now()
            this.lastEntity = entity



            console.log("created beat:", beat)

            return beat


        } catch(e) {

            console.error("failed to create beat:", e)
            return null
        }
    }






    //record typing 


    recordEdit(): heartbeat | null {

        return this.createBeat(true)
    }





    //reading one, it shows on hackatime i saw


    recordRead(): heartbeat | null {


        return this.createBeat(false)
    }






    //manual reset when i debug

    reset(): void {

        this.lastBeatTime = 0
        this.lastEntity = ''

        console.log("tracker reset")
    }
}
