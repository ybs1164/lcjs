const readline = require("readline");
const run = require("./lc");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

let global = {};

rl.on('line', (input) => {
    if (input === 'q') {
        rl.close();
    } else {
        const expr = run(global, input);
        console.log(expr.toString());
        if (expr.id === "Definition") {
            global[expr.name] = expr.body;
        }
    }
});