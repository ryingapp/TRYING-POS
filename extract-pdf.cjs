const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const dataBuffer = fs.readFileSync('C:\\Users\\msaz1\\Downloads\\ZAKATA\\ZAKAH.pdf');
const parser = new PDFParse({ data: dataBuffer });
parser.getText().then(function(result) {
  console.log(result.text);
}).catch(function(err) {
  console.error('Error:', err.message);
});
