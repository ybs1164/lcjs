const readline = require("readline");
const run = require("./lc");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.on('line', (input) => {
    if (input === 'q') {
        rl.close();
    } else {
        console.log(run(input));
    }
});