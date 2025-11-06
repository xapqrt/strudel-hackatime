// js build config had to edit a bit


const esbuild = require('esbuild');


async function build() {


    // the bg worker here

    await esbuild.build({


        entryPoints: ['background.ts'],
        bundle: true,


        outfile: 'dist/background.js',
        format: 'esm',


        platform: 'browser',


        target: 'es2020'
    });



    // bundle content script

    await esbuild.build({

        entryPoints: ['content.ts'],
        bundle: true,

        outfile: 'dist/content.js',
        format: 'iife',


        platform: 'browser',

        target: 'es2020'
    });



    // bundle popup

    await esbuild.build({

        entryPoints: ['popup.ts'],
        bundle: true,


        outfile: 'dist/popup.js',
        format: 'iife',
        platform: 'browser',

        target: 'es2020'



    });
    
    


    // injected into page context this one
    
    await esbuild.build({
        
        entryPoints: ['page-script.ts'],
        bundle: true,
        outfile: 'dist/page-script.js',
        format: 'iife',
        platform: 'browser',


        target: 'es2020'
    });
    
    
    // bundle offscreen document script
    
    await esbuild.build({


        
        entryPoints: ['offscreen.ts'],
        bundle: true,
        outfile: 'dist/offscreen.js',
        format: 'iife',
        platform: 'browser',
        
        target: 'es2020'
    });


    console.log('build complete');
}


build().catch(e => {

    console.error('build failed:', e);
    process.exit(1);
});
