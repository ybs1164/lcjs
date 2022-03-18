const token = (type, value) => ({
	type,
	value
});

const AST = {
    Abstraction(param, body) {
        return {
            id: "Abstraction",
            param: param,
            body: body,
            toString(ctx=[]) {
                return `(\\${param}. ${body.toString([param].concat(ctx))})`;
            }
        };
    },
    Application(lhs, rhs) {
        return {
            id: "Application",
            lhs: lhs,
            rhs: rhs,
            toString(ctx) {
                return `${lhs.toString(ctx)} ${rhs.toString(ctx)}`;
            }
        };
    },
    Identifier(name) {
        return {
            id: "Identifier",
            name: name,
            toString(ctx) {
                return ctx[name];
            }
        };
    }
};

function lexer(str) {
    const letterToken = (char) => {
        switch (char) {
            case '\\':
                return token("LAMBDA");
            case '.':
                return token("DOT");
            case '(':
                return token("LPAREN");
            case ')':
                return token("RPAREN");
            case '\0':
                return token("EOF");
            case ' ':
                return [];
            default:
                return null;
        }
    };

    const isAlpha = (char) => {
        if (char >= 'a' && char <= 'z'
         || char >= 'A' && char <= 'Z') {
            return true;
        }
        return false;
    };
    
    const getTokens = (index, tokens, id) => {
        if (str.length < index) return tokens;
        if (isAlpha(str[index])) {
            return getTokens(index+1, tokens, id.concat(str[index]));
        }
        if (id !== "") {
            return getTokens(index, tokens.concat(
                token("LCID", id)
            ), "");
        }
        return getTokens(index+1, tokens.concat(
            letterToken(str[index])
        ), "");
    };

    return getTokens(0, [], "");
}

function parser(tokens) {
    let index = 0;

    const currentToken = () => tokens[index];
    const next = (type) => currentToken()?.type == type;
    const skip = (type) => {
        if (next(type)) {
            index += 1;
            return true;
        } else {
            return false;
        }
    };
    const match = (type) => {
        if (next(type)) {
            index += 1;
        }
    };
    const token = (type) => {
        if (next(type)) {
            const value = currentToken().value;
            index += 1;
            return value;
        } else {
            return null;
        }
    };

    const term = (ctx) => {
        // term ::= LAMBDA LCID DOT term
        //        | application
        if (skip("LAMBDA")) {
            const id = token("LCID");
            match("DOT");
            const t = term([id].concat(ctx));
            return AST.Abstraction(id, t);
        } else {
            return application(ctx);
        }
    };

    // application ::= application atom | atom
    const application = (ctx) => {
        // application ::= atom application
        let lhs = atom(ctx);

        while (true) {
            // application' ::= atom application'
            //                | epsilion
            const rhs = atom(ctx);
            if (!rhs) {
                return lhs;
            } else {
                lhs = AST.Application(lhs, rhs);
            }
        }
    };

    const atom = (ctx) => {
        // atom ::= LPAREN term RPAREN
        //        | LCID
        if (skip("LPAREN")) {
            const t = term(ctx);
            match("RPAREN");
            return t;
        } else if (next("LCID")) {
            const id = token("LCID");
            return AST.Identifier(ctx.indexOf(id));
        } else {
            return null;
        }
    };

    return term([]);
}

function interpriting(ast) {
    const isValue = node => node.id === "Abstraction";

    const eval = ast => {
        while (true) {
            if (ast.id === "Application") {
                if (isValue(ast.lhs) && isValue(ast.rhs)) {
                    ast = substitute(ast.rhs, ast.lhs.body);
                } else if (isValue(ast.lhs)) {
                    ast.rhs = eval(ast.rhs);
                } else {
                    ast.lhs = eval(ast.lhs);
                }
            } else {
                return ast;
            }
        }
    };

    const traverse = f => (node, ...args) => {
        const config = f(...args);
        if (node.id === "Application") {
            return config.Application(node);
        } else if (node.id === "Abstraction") {
            return config.Abstraction(node);
        } else if (node.id === "Identifier") {
            return config.Identifier(node);
        }
    };

    const shift = (by, node) => {
        const aux = traverse(from => ({
            Application(app) {
                return AST.Application(
                    aux(app.lhs, from),
                    aux(app.rhs, from)
                );
            },
            Abstraction(abs) {
                return AST.Abstraction(
                    abs.param,
                    aux(abs.body, from + 1)
                );
            },
            Identifier(id) {
                return AST.Identifier(
                    id.name + (id.name >= from ? by : 0)
                );
            }
        }));
        return aux(node, 0);
    };

    const subst = (value, node) => {
        const aux = traverse(depth => ({
            Application(app) {
                return AST.Application(
                    aux(app.lhs, depth),
                    aux(app.rhs, depth)
                );
            },
            Abstraction(abs) {
                return AST.Abstraction(
                    abs.param,
                    aux(abs.body, depth + 1)
                );
            },
            Identifier(id) {
                if (depth === id.name) {
                    return shift(depth, value);
                } else {
                    return id;
                }
            }
        }));
        return aux(node, 0);
    };

    const substitute = (value, node) => {
        return shift(-1, subst(shift(1, value), node));
    };

    return eval(ast);
}

function run(str) {
    return interpriting(parser(lexer(str))).toString();
}

const input = "(\\x. \\y. x) (\\y. y) (\\x. x)";
console.log(run(input));