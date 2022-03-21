const util = require("util");

const token = (type, value) => ({
	type,
	value
});

const AST = {
    Abstraction(param, body) {
        return {
            id: "Abstraction",
            param,
            body,
            toString(ctx=[]) {
                return `(\\${param}. ${body.toString([param].concat(ctx))})`;
            }
        };
    },
    Application(lhs, rhs) {
        return {
            id: "Application",
            lhs,
            rhs,
            toString(ctx) {
                return `${lhs.toString(ctx)} ${rhs.toString(ctx)}`;
            }
        };
    },
    Identifier(name) {
        return {
            id: "Identifier",
            name,
            toString(ctx) {
                return ctx[name];
            }
        };
    },
    Definition(name, abs) {
        return {
            id: "Definition",
            name: name,
            body: abs,
            toString(ctx) {
                return `${name} = ${abs.toString(ctx)}`;
            }
        }
    }
};

const lexer = (str) => {
    const letterToken = (char) => {
        switch (char) {
            case '\\':
                return token("LAMBDA");
            case '.':
                return token("DOT");
            case '=':
                return token("EQUAL");
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
        return char >= 'a' && char <= 'z'
         || char >= 'A' && char <= 'Z';
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
};

const parser = (global, tokens) => {
    const iter = (index) => {
        const current = () => tokens[index];
        const next = (type) => current()?.type === type;
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
                const value = current().value;
                index += 1;
                return value;
            } else {
                return null;
            }
        };

        return {
            next,
            skip,
            match,
            token,
            clone() {
                return iter(index);
            }
        }
    };
    
    const term = (ctx, it) => {
        // term ::= LAMBDA LCID DOT term
        //        | application
        if (it.skip("LAMBDA")) {
            const id = it.token("LCID");
            it.match("DOT");
            const t = term({
                global: ctx.global,
                local: [id].concat(ctx.local)
            }, it);
            return AST.Abstraction(id, t);
        } else {
            return application(ctx, it);
        }
    };

    // application ::= application atom | atom
    const application = (ctx, it) => {
        // application ::= atom application'

        const application_ = (ctx, it, lhs) => {
            // application' ::= atom application'
            //                | epsilion
            const rhs = atom(ctx, it);
            if (rhs === null) {
                return lhs;
            } else {
                return application_(ctx, it, AST.Application(lhs, rhs));
            }
        }

        return application_(ctx, it, atom(ctx, it));
    };

    const atom = (ctx, it) => {
        // atom ::= LPAREN term RPAREN
        //        | LCID
        if (it.skip("LPAREN")) {
            const t = term(ctx, it);
            it.match("RPAREN");
            return t;
        } else if (it.next("LCID")) {
            const id = it.token("LCID");
            if (ctx.local.indexOf(id) !== -1) {
                return AST.Identifier(ctx.local.indexOf(id));
            } else if (id in ctx.global) {
                return ctx.global[id];
            } else {
                return null;
            }
        } else {
            return null;
        }
    };

    const define = (ctx, it) => {
        // define ::= LCID EQUAL term
        if (it.next("LCID")) {
            const id = it.token("LCID");
            if (!it.skip("EQUAL")) {
                return null;
            }
            const t = term(ctx, it);
            return AST.Definition(id, t);
        } else {
            return null;
        }
    }

    const query = (ctx, it) => {
        // query ::= define | term
        if (it.next("LCID")) {
            const def = define(ctx, it.clone());
            if (def !== null) {
                return def;
            }
        }
        return term(ctx, it);
    }


    return query({global, local: []}, iter(0));
};

// todo : normalize
const interpriting = (ast, normalize=false) => {
    const isValue = node => node.id === "Abstraction";

    const eval = ast => {
        if (ast.id === "Application") {
            if (!isValue(ast.lhs)) {
                ast.lhs = eval(ast.lhs);
            }
            if (!isValue(ast.rhs)) {
                ast.rhs = eval(ast.rhs);
            }
            // console.log(
            //     util.inspect(ast, false, null, true)
            // );
            // console.log(ast.toString());
            return eval(substitute(ast.rhs, ast.lhs.body));
        } else if (ast.id === "Definition") {
            return AST.Definition(
                ast.name,
                eval(ast.body)
            );
        } /* else if (normalize && isValue(ast)){
            return AST.Abstraction(
                ast.param,
                eval(ast.body)
            );
        } */ else {
            return ast;
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
};

const run = (global, str, normalize=false) => {
    return interpriting(
        parser(
            global,
            lexer(str)
        ),
        // normalize
    );
};

module.exports = run;