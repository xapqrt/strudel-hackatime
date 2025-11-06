// js setting up the type definitions for the heartbeat and the internal state types, amma get that bonus




//reaad the docs a bit so  lemme js write the payloads it want


export interface heartbeat {

    entity : string
    type: "file"
    time: number 
    language: string
    is_write: boolean
    project?: string
    editor?: string
    plugin?: string



    //these are the optional ones but amma try to send em too


    lines?: number
    lineno?: number
    cursorpos?: number
    branch?: string
    category?: string
    source_type?: string
    operating_system?: string
    machine?: string
    user_agent?: string


}


//metadata files for the cursro state


export interface HeartbeatMetadata{

    lines: number
    lineno: number
    cursorpos: number


}



//config stored in chrome.storage idk if people will be able to manipulate this or not



export interface StorageConfig {


    apiKey?: string
    enabled?: boolean
    lastSync?: number
    
    totalTime?: number
    streak?: number
    projectName?: string
    beatCount?: number
    lastBeatTime?: number

}



//queued heartbeat


export interface QueuedBeat {
    beat: heartbeat
    retries: number
    queued_at: number


}



//stats from hackatime api


export interface StatsResponse {
    data?: {
        grand_total?: {

            total_seconds?: number
        }



        range?: {

            start?: string
            end?: string
        }
    }
}