const Babel = require('@babel/standalone');
console.log(Babel.transform('const a = <div />;', { presets: ['react'] }).code);
