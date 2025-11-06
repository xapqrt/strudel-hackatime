// quick icon generator
const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // bg
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, size, size);
    
    // text
    ctx.fillStyle = '#0a0e14';
    ctx.font = `bold ${size * 0.6}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', size / 2, size / 2);
    
    return canvas.toBuffer('image/png');
}

// create icons
fs.writeFileSync('icons/icon16.png', createIcon(16));
fs.writeFileSync('icons/icon48.png', createIcon(48));
fs.writeFileSync('icons/icon128.png', createIcon(128));

console.log('icons created');
