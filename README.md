# Hackatime for Strudel

yo this is a chrome extension that tracks your strudel.cc live coding sessions on hackatime

made for hackclub carnival btw


## what it does

- tracks your edits on strudel.cc
- sends heartbeats to hackatime api
- shows your coding time on the hackatime dashboard
- queues beats when offline and retries later


## setup

1. clone this repo
```bash
git clone https://github.com/xapqrt/strudel-hackatime.git
cd strudel-hackatime
```

2. install deps
```bash
npm install
```

3. build it
```bash
npm run build
```

4. load in chrome
- go to `chrome://extensions`
- turn on developer mode
- click "load unpacked"
- select the `strudel hackatime` folder

5. get your api key
- go to https://hackatime.hackclub.com
- grab your api key from settings

6. configure extension
- click extension icon
- paste api key
- done


## how it works

uses codemirror 6 hooks to detect when you type or move cursor, sends heartbeats to hackatime every 30 seconds (wakatime spec), queues failed beats and retries later

had to inject a page script to access codemirror directly cuz content scripts cant see page context, promise based message passing between content and page script to get cursor position


## tech stack

- typescript
- esbuild for bundling
- chrome manifest v3
- codemirror 6 detection


## known issues

- editor field shows "Unknown" on dashboard even tho we spam strudel everywhere
- tried user-agent modification, declarativeNetRequest, offscreen xhr, nothing works yet
- line numbers and cursor position work perfectly tho


## files

- `background.ts` - service worker, api calls, queue management
- `content.ts` - injected into strudel.cc, hooks editor
- `page-script.ts` - injected into page context, accesses codemirror
- `tracker.ts` - heartbeat creation logic
- `metadata.ts` - extracts cursor position, line numbers
- `popup.ts` - extension popup ui
- `storage.ts` - chrome storage wrapper
- `build.js` - esbuild config


## build system

changed from tsc to esbuild bundling, bundles 5 files:
- background.js (esm module)
- content.js (iife)
- popup.js (iife)
- page-script.js (iife)
- offscreen.js (iife)

all imports changed to esm style with .js extensions


## dev

```bash
npm run build
```

then reload extension in chrome


## credits

- perplexity helped w codemirror hooks
- josias for hackatime api docs
- fd for future help hopefully


## status

cursor tracking: ✅ works
line numbers: ✅ works  
editor name: ❌ shows "Unknown" (contacted fd)


aight thats it
