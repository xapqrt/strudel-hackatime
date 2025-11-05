//quick chrome types fallback until @types/chrome is installed


declare namespace chrome {


    namespace runtime {

        function sendMessage(message: any): Promise<any>
        function sendMessage(message: any, responseCallback?: (response: any) => void): void
        function sendMessage(extensionId: string, message: any, responseCallback?: (response: any) => void): void


        const lastError: { message?: string } | undefined


        namespace onMessage {

            function addListener(callback: (message: any, sender: any, sendResponse: any) => void | boolean): void
        }
    }



    namespace storage {


        namespace sync {

            function get(keys: string | string[], callback?: (items: any) => void): Promise<any>
            function set(items: any, callback?: () => void): Promise<void>
        }


        namespace local {

            function get(keys: string | string[], callback?: (items: any) => void): Promise<any>
            function set(items: any, callback?: () => void): Promise<void>
        }
    }



    namespace action {

        function setBadgeText(details: { text: string }): Promise<void>
        function setBadgeBackgroundColor(details: { color: string }): Promise<void>
    }
}
