const fs = require('fs');

async function extractMenu() {
  const dataBuffer = fs.readFileSync('./public/menu.pdf');
  
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(dataBuffer);
    console.log('=== PDF TEXT CONTENT ===');
    console.log(data.text);
    console.log('=== END ===');
    console.log('Pages:', data.numpages);
  } catch (err) {
    console.error('Error:', err);
  }
}

extractMenu();
