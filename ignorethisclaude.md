
    else if(msg.type === 'GET_QUEUE_SIZE') {


        //popup asking for queue size

        store.getQueue().then(q => {

            sendResponse({ size: q.length })
        })


        return true
    }



    else if(msg.type === 'RETRY_QUEUE') {


        //manual retry from popup

        console.log('manual retry triggered')

        processQueue().then(() => {

            sendResponse({ ok: true })
        })


        return true
    }